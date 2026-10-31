import { closeSync, constants, openSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bashRefusal } from "./bash-refusal.ts";
import { declaredPlace, jobPlace, type Place, real } from "./job-place.ts";
import { refusal } from "./path-refusal.ts";

// The worktree guard (spec/roadmap.md, entry 20): an OMP extension the wrapper loads into every job with `-e`, beside the env guard, that refuses a tool call
// writing into the main checkout, the home folder, another job's worktree, any project's checkout or job worktree, Arthur's install, config folder and env
// file, or the user's `~/.ssh`, `~/.config/systemd` and Git config (job-place.ts), before the tool runs. `ARTHUR_JOB` names the job's record, which says where
// they are, the other projects as declared now; the home folder holds the record, and a project's jobs' worktrees sit in `.arthur-worktrees` beside its
// checkout. Reading passes everywhere; writing anywhere else (the job's own worktree, /tmp) passes. Without `ARTHUR_JOB` (not in a job) it refuses nothing.

type Verdict = { block: true; reason: string } | undefined;
type ExtensionApi = { on(event: "tool_call", handler: (event: { readonly toolName: string; readonly input: Readonly<Record<string, unknown>> }) => Verdict): void };

// The files an `edit` input names: each `[path#TAG]` header and each `MV` target; `+` body lines are text.
function editPaths(input: string): string[] {
	return input.split("\n").flatMap((line) => (line.startsWith("+") ? [] : ((/^\[(.+)#[0-9A-Fa-f]{4}\]\s*$/.exec(line) ?? /^MV\s+["']?(.+?)["']?\s*$/.exec(line))?.slice(1, 2) ?? [])));
}

// The line that refuses a call writing into a guarded place, or undefined: an `edit` or `write` of a path there (one with a scheme, `local://`, is no file), or a bash command run in its `cwd` (the worktree when none) that `bashRefusal` stops.
export function worktreeRefusal(place: Place, toolName: string, input: Readonly<Record<string, unknown>>): string | undefined {
	if (toolName === "bash") return typeof input.command === "string" ? bashRefusal(place, input.command, real(resolve(place.worktree, typeof input.cwd === "string" ? input.cwd : "."))) : undefined;
	if (toolName !== "edit" && toolName !== "write") return undefined;
	const paths = [...(typeof input.path === "string" ? [input.path] : []), ...(typeof input.input === "string" ? editPaths(input.input) : [])];
	return paths.filter((path) => !/^[a-z][a-z0-9+.-]*:\/\//i.test(path)).map((path) => refusal(place, real(resolve(place.worktree, path.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"))), path)).find(Boolean);
}

// `tool_call` fires before the tool runs, and a handler that throws blocks the call too. The other projects are read anew on each call; when their list cannot be read, the record's is used, said once in the job's log.
export default function worktreeGuard(pi: ExtensionApi): void {
	const record = process.env.ARTHUR_JOB;
	if (record === undefined || record === "") return;
	const place = jobPlace(record);
	let said = false;
	// Said once, appended without creating `log`: a record a `rm -r` is emptying gets no new file, and the wrapper ends the job.
	const fallback = (reason: string) => {
		if (said) return;
		said = true;
		try {
			const fd = openSync(join(record, "log"), constants.O_WRONLY | constants.O_APPEND);
			writeFileSync(fd, `[arthur ${new Date().toISOString()}] worktree guard: the project list is unreadable (${reason}); guarding the projects this job's record lists\n`);
			closeSync(fd);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	};
	pi.on("tool_call", (event) => {
		const reason = worktreeRefusal(declaredPlace(place, fallback), event.toolName, event.input);
		return reason === undefined ? undefined : { block: true, reason };
	});
}

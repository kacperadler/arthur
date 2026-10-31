import { spawnSync } from "node:child_process";
import { appendFileSync, lstatSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// Delivery's OMP extension (spec/roadmap.md, entry 53), which each job's agent loads with `-e` after the core's own
// (`host.jobs.registerExtension`): after each bash call it adds to the job's `checks`, `<home>/delivery/<job>/checks`, what a run
// of the project's own checks said, each line ending with the commit the call began on and `clean` only when the tree was the
// same clean one as the call began and as it ended, else `dirty` (AR0436). `arthur review-needed` reads it:
// docs/commands/review-needed.md, "The job's checks". A bash call that runs them gets a timeout of at least 1800 seconds (AR0569):
// omp kills a call at its timeout, 300 seconds when it names none, and a killed check gives no result.

type Script = "check" | "test" | "mutate";
type ToolEvent = { readonly toolCallId?: unknown; readonly toolName?: unknown; readonly input?: { readonly command?: unknown; readonly timeout?: unknown }; readonly content?: unknown; readonly details?: { readonly async?: unknown }; readonly isError?: unknown };
type ExtensionApi = { on(event: "tool_call" | "tool_result", handler: (event: ToolEvent, ctx: { readonly cwd: string }) => { readonly input: object } | undefined): void };
type Tree = { readonly head: string; readonly files: string; readonly clean: boolean };

export default function checks(pi: ExtensionApi): void {
	const record = process.env.ARTHUR_JOB;
	if (record === undefined || record === "") return;
	// The job's record is `<home>/jobs/<id>`, and delivery's folder `<home>/delivery`.
	const file = join(dirname(dirname(record)), "delivery", basename(record), "checks");
	// The tree each bash call that runs the checks began on, by its call's id, until its result. A handler that throws blocks
	// the call; none of these does. The input a `tool_call` handler returns is the one omp runs the call with.
	const began = new Map<unknown, Tree | undefined>();
	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "bash" || scripts(event.input?.command, ctx.cwd).length === 0) return;
		began.set(event.toolCallId, tree(ctx.cwd));
		return { input: { ...event.input, timeout: Math.max(typeof event.input?.timeout === "number" ? event.input.timeout : 0, 1800) } };
	});
	pi.on("tool_result", (event, ctx) => {
		const before = began.get(event.toolCallId);
		began.delete(event.toolCallId);
		const lines = event.toolName === "bash" ? ran(event, ctx.cwd) : [];
		const after = lines.length === 0 ? undefined : tree(ctx.cwd);
		if (after === undefined) return;
		// The same commit and the same untouched files: the tree the checks ran on is the one read as the call ended; mutate (AR0579) writes files and puts them back, so the same clean commit at both ends.
		const clean = (line: string) => before !== undefined && before.head === after.head && after.clean && (line.startsWith("mutate") ? before.clean : before.files === after.files);
		mkdirSync(dirname(file), { recursive: true });
		appendFileSync(file, lines.map((line) => `${line} ${(before ?? after).head} ${clean(line) ? "clean" : "dirty"}\n`).join(""));
	});
}

// The worktree's HEAD, each tracked file's inode, size and times (any write changes its ctime, so a file rewritten and put
// back, by Git or not, changes them) and `clean` when no tracked file differs from HEAD and none is one Git is told not to look
// at (`assume-unchanged`, `skip-worktree`: a tag other than `H` in `git ls-files -v`); an untracked file is on no branch.
// Outside Git, undefined. No hook or fsmonitor the worktree's config names runs, nor a replacement (refs/replace) is read:
// the job may have set them (AR0330, AR0384).
function tree(cwd: string): Tree | undefined {
	const git = (...words: string[]) => spawnSync("git", ["--no-optional-locks", "--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", cwd, ...words], { encoding: "utf8" });
	const [head, status, tracked] = [git("rev-parse", "HEAD"), git("status", "--porcelain", "--untracked-files=no"), git("ls-files", "-v", "-z")];
	if (head.status !== 0 || status.status !== 0 || tracked.status !== 0) return undefined;
	const entries = tracked.stdout.split("\0").filter(Boolean);
	const files = entries.map((entry) => {
		// A path gone or unreachable (its folder now a file, ENOTDIR, or unreadable): its error, as a handler must not throw.
		try {
			const stat = lstatSync(join(cwd, entry.slice(2)), { bigint: true });
			return `${stat.ino} ${stat.size} ${stat.mtimeNs} ${stat.ctimeNs}`;
		} catch (error) {
			return (error as NodeJS.ErrnoException).code ?? "unreadable";
		}
	});
	return { head: head.stdout.trim(), files: files.join("\n"), clean: status.stdout === "" && entries.every((entry) => entry.startsWith("H ")) };
}

// The lines of one bash call: `check pass|fail` per `npm run check`, `test pass|fail <passed>/<total>` per `npm test` (`npm t`,
// `npm run test`), `mutate pass|fail` per `npm run mutate`, in the command's order, for the scripts the worktree's package.json
// declares; any other command, or a call the bash tool moved to the background (it returned before the checks did), none.
// Commands joined by `;`, `&&` or `|` give one exit status, so the output decides too: a check fails on a TypeScript error; a
// test takes pass or fail from node --test's last summary (`fail 0` passes), and from the exit status without one; mutate
// passes only on an exit status of 0 and a last summary with `0 survived`.
function ran(event: ToolEvent, cwd: string): string[] {
	if (event.details?.async !== undefined) return [];
	const runs = scripts(event.input?.command, cwd);
	const output = Array.isArray(event.content) ? event.content.map((part: { readonly text?: unknown }) => (typeof part?.text === "string" ? part.text : "")).join("\n") : "";
	const failed = event.isError === true;
	const count = (word: string) => Array.from(output.matchAll(new RegExp(`^\\S+ ${word} (\\d+)\\s*$`, "gm"))).at(-1)?.[1];
	const [tests, passed, failures] = [count("tests"), count("pass"), count("fail")];
	return runs.map((name) => {
		if (name === "check") return `check ${failed || /\berror TS\d+|^error:/m.test(output) ? "fail" : "pass"}`;
		if (name === "mutate") return `mutate ${!failed && Array.from(output.matchAll(/^mutate: \d+ mutants, \d+ caught, (\d+) survived/gm)).at(-1)?.[1] === "0" ? "pass" : "fail"}`;
		if (tests === undefined || passed === undefined || failures === undefined) return `test ${failed ? "fail" : "pass"}`;
		return `test ${failures === "0" ? "pass" : "fail"} ${passed}/${tests}`;
	});
}

// The runs of the `check`, `test` and `mutate` scripts the package.json in `worktree` declares that `command` names, in its
// order; a missing or broken package.json declares none.
function scripts(command: unknown, worktree: string): Script[] {
	if (typeof command !== "string") return [];
	let declared: readonly Script[];
	try {
		const { scripts } = JSON.parse(readFileSync(join(worktree, "package.json"), "utf8")) as { readonly scripts?: Readonly<Record<string, unknown>> };
		declared = (["check", "test", "mutate"] as const).filter((name) => typeof scripts?.[name] === "string");
	} catch {
		return [];
	}
	return Array.from(command.matchAll(/(?:^|[;&|(\n])\s*npm\s+(test|t|run\s+(?:test|check|mutate))(?=$|[\s;&|)])/g), (match): Script => (match[1]?.endsWith("check") ? "check" : match[1]?.endsWith("mutate") ? "mutate" : "test")).filter((name) => declared.includes(name));
}

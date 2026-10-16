import { readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { gitCall } from "./git-writes.ts";
import { type Command, type Item, literal, shellCommands } from "./shell-words.ts";

// The worktree guard (spec/roadmap.md, entry 20): an OMP extension the wrapper loads into every job with `-e`, beside the env
// guard, that refuses a tool call writing into the main checkout, the home folder, or another job's worktree before the tool
// runs. `ARTHUR_JOB` names the job's record, which says where the job's worktree and the main checkout are; the home folder
// holds the record, and every job's worktree sits in the folder that holds this one's. Reading passes everywhere; writing
// anywhere else (the job's own worktree, /tmp) passes. Without `ARTHUR_JOB` (not in a job) it refuses nothing.

type Verdict = { block: true; reason: string } | undefined;
type ExtensionApi = { on(event: "tool_call", handler: (event: { readonly toolName: string; readonly input: Readonly<Record<string, unknown>> }) => Verdict): void };
// Absolute paths with their symlinks resolved; `branch` is empty for a read-only kind's detached checkout.
export type Place = { readonly worktree: string; readonly branch: string; readonly home: string; readonly root: string; readonly worktrees: string };

// Commands that run the command after them, with their options that take a value: `timeout 60 rm x` is `rm`.
const WRAPPERS: Readonly<Record<string, readonly string[]>> = {
	...Object.fromEntries(["command", "builtin", "exec", "nohup", "setsid", "unbuffer", "chrt"].map((name) => [name, []])),
	...{ sudo: ["-u", "-g", "-h", "-p", "-C", "-D", "-R", "-T", "-U"], doas: ["-u", "-C"], env: ["-u", "-C", "-S"], time: ["-f", "-o"] },
	...{ timeout: ["-s", "-k"], nice: ["-n"], ionice: ["-c", "-n", "-p", "-t"], stdbuf: ["-i", "-o", "-e"], xargs: ["-n", "-P", "-I", "-L", "-s", "-a", "-d", "-E", "-l", "-i"] },
};
// Words that start a command without being one.
const RESERVED = ["{", "}", "!", "if", "then", "else", "elif", "do", "while", "until"];
const SHELLS = ["bash", "sh", "zsh", "dash", "ksh"];
// A command that may change every operand, and one that writes only its last operand or the folder after `-t`.
const WRITES = ["mv", "rm", "rmdir", "touch", "mkdir", "truncate", "chmod", "chown", "chgrp", "unlink", "shred", "patch", "tee", "sponge"];
const COPIES = ["cp", "install", "rsync", "scp"];
const STASH = "arthur: refused: git stash keeps one stack for every worktree of the repository, so a pop may apply another job's change here; save a patch instead (git diff > /tmp/<name>.patch, then git apply /tmp/<name>.patch)";

const inside = (path: string, folder: string): boolean => path === folder || path.startsWith(folder.endsWith(sep) ? folder : folder + sep);

// `path` with its nearest existing ancestor resolved through symlinks, and a link whose target does not exist yet followed,
// so a link cannot name a place its target is not.
function real(path: string, depth = 0): string {
	for (let rest = "", at = path; ; at = dirname(at)) {
		try {
			return join(realpathSync(at), rest);
		} catch {
			try {
				if (depth < 40) return real(join(resolve(dirname(at), readlinkSync(at)), rest), depth + 1);
			} catch {}
			if (dirname(at) === at) return path;
			rest = join(basename(at), rest);
		}
	}
}

// The line that refuses writing `path` (absolute, resolved), or undefined when it is not a guarded place.
function refusal(place: Place, path: string, shown = path): string | undefined {
	if (inside(path, place.worktree)) return undefined;
	const name = inside(path, place.home) ? "Arthur's home folder" : inside(path, place.worktrees) ? "another job's worktree" : inside(path, place.root) ? "the main checkout" : undefined;
	return name && `arthur: refused: this call writes into ${name} (${shown}); a job writes only in its own worktree ${place.worktree} and outside Arthur's checkouts and home folder`;
}

// The index in `words` of the command they run, after assignments, reserved words and wrappers with their options; -1 if none.
function commandIndex(words: readonly string[]): number {
	for (let index = 0; index < words.length; ) {
		const values = Object.hasOwn(WRAPPERS, basename(words[index]!)) ? WRAPPERS[basename(words[index]!)]! : undefined;
		if (values === undefined && !RESERVED.includes(words[index]!) && !/^[A-Za-z_]\w*=/.test(words[index]!)) return index;
		for (index++; values !== undefined && index < words.length && /^-|^[\d.]+[smhd]?$/.test(words[index]!); ) index += values.includes(words[index]!) ? 2 : 1;
	}
	return -1;
}

// Whether a bash command run in `start` writes into a guarded place: a redirect, a writing command (`rm`, `mv`, `sed -i`,
// `cp` into it, `ln` to or in it, `dd of=`, `find -delete` or `-exec`), a `git` write aimed at it, any `git stash`, or one
// of these after a `cd` there. The command is the word after assignments and wrappers (`sudo`, `timeout 60`), also in
// `bash -c`, a shell's heredoc, `eval`; each path is resolved from where the commands before it left (`cd`, `pushd`, `git
// -C`, a subshell undoing them), through symlinks. Not seen: a path built at run time (`$x`, a glob, a brace list, what
// `xargs` reads), a program that writes (`node -e`, `tar -C`, `curl -o`), a link the same call makes. It is not a sandbox.
function bashRefusal(place: Place, command: string, start: string): string | undefined {
	let cwd = start;
	const subshells: string[] = [];
	const pushed: string[] = [];
	const theirs = (words: readonly string[], base = cwd): string | undefined => {
		for (const word of words) {
			for (const path of [...(word.startsWith("-") ? [] : [word]), ...(word.includes("=") ? [word.slice(word.indexOf("=") + 1)] : [])]) {
				const found = refusal(place, real(resolve(base, path)), path);
				if (found !== undefined) return found;
			}
		}
		return undefined;
	};
	const run = (items: readonly Item[]): string | undefined => {
		for (const item of items) {
			if (item === "(") subshells.push(cwd);
			else if (item === ")") cwd = subshells.pop() ?? cwd;
			const found = typeof item === "string" ? undefined : judge(item);
			if (found !== undefined) return found;
		}
		return undefined;
	};
	const judge = (command: Command): string | undefined => {
		const redirected = theirs(command.writes.map(literal));
		const words = command.words.map(literal);
		const at = commandIndex(words);
		if (redirected !== undefined || at < 0) return redirected;
		const verb = basename(words[at]!);
		const args = words.slice(at + 1);
		const operands = args.filter((word) => !word.startsWith("-"));
		if (["cd", "pushd", "popd"].includes(verb)) {
			if (!command.alone) return undefined;
			if (verb === "pushd") pushed.push(cwd);
			cwd = verb === "popd" ? (pushed.pop() ?? cwd) : real(resolve(cwd, operands[0] ?? process.env.HOME ?? cwd));
		} else if (SHELLS.includes(verb)) {
			const flag = args.findIndex((word) => /^-[a-z]*c[a-z]*$/.test(word));
			for (const text of flag >= 0 ? [args[flag + 1] ?? ""] : operands.length === 0 ? command.stdin : []) {
				const found = run(["(", ...shellCommands(text, process.env.HOME), ")"]);
				if (found !== undefined) return found;
			}
		} else if (verb === "eval") return run(shellCommands(args.join(" "), process.env.HOME));
		else if (verb === "git") return git(args);
		else if (verb === "find") return find(args);
		else if (WRITES.includes(verb) || (["sed", "perl"].includes(verb) && args.some((word) => /^-[a-zA-Z]*i|^--in-place/.test(word)))) return theirs(args);
		else if (COPIES.includes(verb)) return theirs([operands.at(-1) ?? "", ...args.filter((word) => word.startsWith("--target-directory")), ...args.filter((_, index) => args[index - 1] === "-t")]);
		else if (verb === "dd") return theirs(args.filter((word) => word.startsWith("of=")));
		else if (verb === "ln") {
			// A link's target is read from the link's folder: the last operand, or where it is made when it names a folder.
			const link = operands.length > 1 ? real(resolve(cwd, operands.at(-1)!)) : cwd;
			const folder = statSync(link, { throwIfNoEntry: false })?.isDirectory() ? link : dirname(link);
			return theirs(operands) ?? (args.some((word) => /^-[a-zA-Z]*s|^--symbolic$/.test(word)) ? theirs(operands.slice(0, Math.max(1, operands.length - 1)), folder) : undefined);
		}
		return undefined;
	};
	// `find <roots> … -delete`, and `-exec`/`-execdir`/`-ok`/`-okdir <command> {} ;`, that command with the roots for `{}`.
	const find = (args: readonly string[]): string | undefined => {
		const expression = args.findIndex((word) => word.startsWith("-") || word === "(" || word === "!");
		const roots = args.slice(0, expression < 0 ? args.length : expression);
		if (roots.length === 0) roots.push(".");
		for (const [index, word] of args.entries()) {
			const close = args.findIndex((other, position) => position > index && (other === ";" || other === "+"));
			const words = args.slice(index + 1, close < 0 ? args.length : close).flatMap((other) => (other.includes("{}") ? roots.map((root) => other.replaceAll("{}", root)) : [other]));
			const found = word === "-delete" ? theirs(roots) : ["-exec", "-execdir", "-ok", "-okdir"].includes(word) ? judge({ words, writes: [], reads: [], stdin: [], alone: false }) : undefined;
			if (found !== undefined) return found;
		}
		return undefined;
	};
	const git = (args: readonly string[]): string | undefined => {
		const { sub, rest, chdirs, trees, writesCheckout, writesOperands } = gitCall(args);
		if (sub === "stash" && !["list", "show"].includes(rest[0] ?? "")) return STASH;
		const dir = chdirs.reduce((base, folder) => real(resolve(base, folder)), cwd);
		// Every worktree shares the repository's refs: one the job does not own moves under the main checkout.
		const ref = rest.filter((word, at) => !word.startsWith("-") && rest[at - 1] !== "-m")[0] ?? "--stdin";
		if (sub === "update-ref" && ref !== "HEAD" && (place.branch === "" || ref !== `refs/heads/${place.branch}`)) return refusal(place, place.root, `git update-ref ${ref}`);
		const tree = writesCheckout ? (theirs([dir]) ?? theirs(trees, dir)) : undefined;
		return tree ?? (writesOperands ? theirs(rest, dir) : undefined);
	};
	return run(shellCommands(command, process.env.HOME));
}

// The files an `edit` input names: each `[path#TAG]` header and each `MV` target; `+` body lines are text.
function editPaths(input: string): string[] {
	return input.split("\n").flatMap((line) => {
		const named = line.startsWith("+") ? undefined : (/^\[(.+)#[0-9A-Fa-f]{4}\]\s*$/.exec(line) ?? /^MV\s+["']?(.+?)["']?\s*$/.exec(line));
		return named?.[1] === undefined ? [] : [named[1]];
	});
}

// The line that refuses a call writing into a guarded place, or undefined: an `edit` or `write` of a path there (one with
// a scheme, `local://`, is no file), or a bash command run in its `cwd` (the worktree when none) that `bashRefusal` stops.
export function worktreeRefusal(place: Place, toolName: string, input: Readonly<Record<string, unknown>>): string | undefined {
	if (toolName === "bash") return typeof input.command === "string" ? bashRefusal(place, input.command, real(resolve(place.worktree, typeof input.cwd === "string" ? input.cwd : "."))) : undefined;
	if (toolName !== "edit" && toolName !== "write") return undefined;
	const paths = [...(typeof input.path === "string" ? [input.path] : []), ...(typeof input.input === "string" ? editPaths(input.input) : [])];
	for (const path of paths.filter((path) => !/^[a-z][a-z0-9+.-]*:\/\//i.test(path))) {
		const found = refusal(place, real(resolve(place.worktree, path.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"))), path);
		if (found !== undefined) return found;
	}
	return undefined;
}

// The places of the job whose record is `record` (`<home>/jobs/<id>`), as the runner wrote them.
export function jobPlace(record: string): Place {
	const field = (name: string) => readFileSync(join(record, name), "utf8").trim();
	const worktree = real(field("worktree"));
	return { worktree, branch: field("branch"), home: real(dirname(dirname(record))), root: real(field("root")), worktrees: dirname(worktree) };
}

// `tool_call` fires before the tool runs, and a handler that throws blocks the call too.
export default function worktreeGuard(pi: ExtensionApi): void {
	const record = process.env.ARTHUR_JOB;
	if (record === undefined || record === "") return;
	const place = jobPlace(record);
	pi.on("tool_call", (event) => {
		const reason = worktreeRefusal(place, event.toolName, event.input);
		return reason === undefined ? undefined : { block: true, reason };
	});
}

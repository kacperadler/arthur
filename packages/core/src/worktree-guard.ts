import { closeSync, constants, openSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { linkedFolders, linkName } from "./git-link.ts";
import { gitCall, UNREAD } from "./git-writes.ts";
import { declaredPlace, jobPlace, type Place, real } from "./job-place.ts";
import { commandIndex } from "./command-index.ts";
import { type Command, type Item, literal, shellCommands } from "./shell-words.ts";

// The worktree guard (spec/roadmap.md, entry 20): an OMP extension the wrapper loads into every job with `-e`, beside the env guard, that refuses a tool call
// writing into the main checkout, the home folder, another job's worktree, any project's checkout or job worktree, Arthur's install, config folder and env
// file, or the user's `~/.ssh`, `~/.config/systemd` and Git config (job-place.ts), before the tool runs. `ARTHUR_JOB` names the job's record, which says where
// they are, the other projects as declared now; the home folder holds the record, and a project's jobs' worktrees sit in `.arthur-worktrees` beside its
// checkout. Reading passes everywhere; writing anywhere else (the job's own worktree, /tmp) passes. Without `ARTHUR_JOB` (not in a job) it refuses nothing.

type Verdict = { block: true; reason: string } | undefined;
type ExtensionApi = { on(event: "tool_call", handler: (event: { readonly toolName: string; readonly input: Readonly<Record<string, unknown>> }) => Verdict): void };

const SHELLS = ["bash", "sh", "zsh", "dash", "ksh"];
// A command that may change every operand, and one that writes only its last operand or the folder after `-t`.
const WRITES = ["mv", "rm", "rmdir", "touch", "mkdir", "truncate", "chmod", "chown", "chgrp", "unlink", "shred", "patch", "tee", "sponge"];
const COPIES = ["cp", "install", "rsync", "scp"];
const STASH = "arthur: refused: git stash keeps one stack for every worktree of the repository, so a pop may apply another job's change here; save your staged and unstaged changes in a folder your worktree ignores instead (mkdir -p .arthur-stash && echo '*' > .arthur-stash/.gitignore && git diff --binary HEAD > .arthur-stash/patch, then git apply .arthur-stash/patch)";
const UNSEEN = "arthur: refused: this git call reads config the guard does not (a shell alias, an include, --config-env, GIT_CONFIG*, HOME or XDG_CONFIG_HOME set for it), or writes an alias or include that later git calls would run unseen; run the command itself instead";
const OLDPWD_UNKNOWN = "arthur: refused: the guard cannot tell where this path leads: OLDPWD is unset, where bash reads `~-` and `$OLDPWD` apart, or named by a `local`, or set at an index bash computes, by a list appended or with indexes, as an index or a list before a command, or changed by an operator of `${OLDPWD…}`; or it is built by an operator of `${PWD…}`, `${HOME…}` or `${ARTHUR_JOB…}` the guard does not read, or by a fallback (`${x:-…}`) with a blank or one of `<>;&|()#` unquoted, or with `$'…'` or `$\"…\"` in double quotes, or by an unquoted `~name` (a user's home or a `dirs` entry); or the command holds a backslash-newline after a character other than a blank, or in `$'…'`, or any after a heredoc's `<<`, where bash joins the lines, or a `<<` after `((` or `$[`, which bash may read as arithmetic; or HOME, ARTHUR_JOB or PWD is set by the call, which the guard reads as the job started, or a variable `export`, `declare`, `typeset`, `readonly`, `local`, `env` or `sudo` sets is named other than by a plain name (letters, digits and `_`, not first a digit, written as is); or the string `env -S` splits holds a backslash, a backtick, a `$`, a `~`, a line break or one of `;&|<>()`, which env reads apart from bash; name the folder instead, on one line";

const inside = (path: string, folder: string): boolean => path === folder || path.startsWith(folder.endsWith(sep) ? folder : folder + sep);

// The line that refuses writing `path` (absolute, resolved), or undefined when it is not a guarded place. Of nested places (a project's checkout inside
// another's, the job's own worktree, no place, in the jobs' folder) the innermost names it. The worktree's `.git` file is its link to the repository, as is any path `named` `.git` or `commondir` (git-link.ts).
function refusal(place: Place, path: string, shown = path, named = true): string | undefined {
	const link = join(place.worktree, ".git");
	const linking = named && (linkName(path) || linkName(shown)) ? `arthur: refused: this call writes ${shown}, which Git reads as a link to a repository (a .git or commondir) and so may make its folder a checkout of main; make or remove a repository's folder with git init, git clone or rm -r instead` : undefined;
	const places: (readonly [string, string])[] = [[place.worktree, ""], [place.home, "Arthur's home folder"], [place.worktrees, "another job's worktree"], [place.root, "the main checkout"], [link, "the main checkout"]];
	for (const other of place.others) places.push([other.worktrees, `a job worktree of project ${other.name}`], [other.root, `the main checkout of project ${other.name}`]);
	for (const each of place.guarded) places.push([each.path, each.name]);
	const name = places.filter(([folder]) => inside(path, folder)).sort(([a], [b]) => b.length - a.length)[0]?.[1];
	return name ? `arthur: refused: this call writes into ${name} (${shown}); a job writes only in its own worktree ${place.worktree}, outside Arthur's checkouts, home folder, install and config, and the user's own files` : linking;
}

// Whether a bash command run in `start` writes into a guarded place, or a `.git` or `commondir`: a redirect, a writing command (`rm`, `mv`, `sed -i`, `cp` into
// it, `ln` to or in it, `dd of=`, `find -delete` or `-exec`), a `git` write aimed at it (also by `GIT_DIR=`, `GIT_WORK_TREE=`, `GIT_INDEX_FILE=`,
// `GIT_OBJECT_DIRECTORY=` or `GIT_COMMON_DIR=` before it or after `env`, an alias its `-c` gives, or a link of its folders), any `git stash`, a `git config`
// that changes the shared, the user's or the system's config, a git call that reads config the guard does not or writes an alias or include, one that may
// point a checkout at a branch another worktree holds (`--ignore-other-worktrees`, `checkout -B`, `symbolic-ref`), `git replace` but a list, one that rewrites
// the repository every worktree shares (`gc`, `prune`, `repack`, `reflog expire`, `maintenance`, `filter-repo`, `worktree prune`, `worktree add` or `move`
// outside the worktrees folder, `gc.*` or `maintenance.*` config given or written), or one of these after a `cd` there. The command is the word after
// assignments and wrappers (`sudo`, `timeout 60`, the words `env -S` splits), also in `bash -c`, a shell's heredoc, `eval`; each path is resolved from where the commands before it left
// (`cd`, `cd -`, `pushd`, `git -C`, a subshell undoing them; `env -C` and `sudo -D` for the command alone, not the redirects the shell opens or its `$PWD`), through symlinks, with `$HOME`, `$ARTHUR_JOB` and `$PWD` known; one of them set by the call, before a command but `git` (which refuses it as config unseen), alone or by `export`, `declare`, `typeset`, `readonly` or `local`, or any name one of those builtins, `env` or `sudo` sets that is not a plain name (letters, digits and `_`, not first a digit, with no expansion, glob, brace list, index or escape: `export {HOME,X}=…`, `env HOM[E]=…`, `export HOM@(E)=…`, `export $v=…`), is refused as unknown, every word being read with the values the job started with. Not seen: a path built at run time (another `$x`, a glob, a brace list, what `xargs` reads, an `OLDPWD` `read` sets, a `GIT_DIR` exported before), a program that writes (`node -e`, `tar -C`, `curl -o`), an alias in the user's Git config, a link the same call makes and uses, or a ref no worktree has checked out moved from the job's own worktree. It is not a sandbox. A backslash-newline after a character other than a blank, or in `$'…'` (which keeps it where the parser decodes it away), or any after a heredoc's `<<`, in the call or in what a shell or `eval` in it runs (`$'…'` may make one there), is unknown (`\0`): bash joins the lines there and the parser does not (AR0493); so is a `<<` after `((` or `$[`, which bash may read as arithmetic and the parser as a heredoc.
function bashRefusal(place: Place, command: string, start: string): string | undefined {
	let cwd = start;
	// Where `cd -`, `~-` and `$OLDPWD` (shell-words.ts reads it as `~-`, with another operator `\0-`) go: bash's OLDPWD, from the agent's env; none when unset.
	let [previous, fixed, pushed] = [process.env.OLDPWD, false, [] as string[]];
	const [known, subshells, configured] = [{ HOME: process.env.HOME, ARTHUR_JOB: process.env.ARTHUR_JOB }, [] as [string, string | undefined, string[], boolean][], [] as string[]];
	const located = (base: string, path: string): string => real(resolve(base, path.replace(/^~-(?=\/|$)/, previous || "~-")));
	const parse = (text: string): Item[] => (/(?<![ \t])\\\n|(?<!<)<<(?!<)[^]*\\\n|\$'(?:[^'\\]|\\[^])*\\\n|(?:\(\(|\$\[)[^]*<</.test(text) ? [{ words: ["\0"], writes: [], reads: [], stdin: [], alone: true }] : shellCommands(text, known));
	// A `~+` without a backslash (`$PWD`, or the prefix `~+` alone or before `/` at a word's start or after its `=`; shell-words.ts), and `\0+` in a here-string or a heredoc a shell reads: where the shell is.
	const here = (word: string): string => word.replace(/(?<!\\)((?:\\\\)*)~\+/g, (_, slashes: string) => slashes + cwd.replaceAll("\\", "\\\\"));
	const theirs = (words: readonly string[], base = cwd, named = true): string | undefined =>
		words.flatMap((word) => [...(word.startsWith("-") ? [] : [word]), ...(word.includes("=") ? [word.slice(word.indexOf("=") + 1)] : [])]).map((path) => refusal(place, located(base, path), path, named)).find(Boolean);
	const run = (items: readonly Item[]): string | undefined => {
		for (const item of items) {
			if (item === "(") subshells.push([cwd, previous, [...pushed], fixed]);
			else if (item === ")") [cwd, previous, pushed, fixed] = subshells.pop() ?? [cwd, previous, pushed, fixed];
			const found = typeof item === "string" ? undefined : judge(item);
			if (found !== undefined) return found;
		}
	};
	const judge = (command: Command, moved = false): string | undefined => {
		const [raw, words] = [command.words.map(here), command.words.map((word) => literal(here(word)))];
		const [at, dirs, split] = commandIndex(words), verb = basename(words[at] ?? ""), declares = ["export", "declare", "typeset", "readonly", "local"].includes(verb), from = declares ? at : words.findIndex((word) => ["env", "sudo"].includes(basename(word))), named = (index: number) => from >= 0 && index > from && index <= (declares ? words.length : at);
		// The words `env -S` splits its string into replace its option and value, as bash splits them when the string holds none of the characters env reads apart; a word bash built at run time stays so, one up to the value at the first word the string gives.
		if (split !== undefined && /[\\`$~;&|<>()\n]/.test(split[1])) return OLDPWD_UNKNOWN;
		if (split !== undefined) {
			const [end, spliced] = [split[0], [...command.words.slice(0, at), ...parse(split[1]).flatMap((item) => (typeof item === "string" ? [] : item.words))]];
			return judge({ ...command, words: [...spliced, ...command.words.slice(end)], dynamic: command.dynamic?.map((index) => (index < end ? at : index - end + spliced.length)) });
		}
		if ([...command.words, ...command.writes].some((word) => word.includes("\0") || ((!previous || previous.includes("\0")) && /(^|=)~-(\/|$)/.test(literal(word)))) || command.words.some((word, index) => /^OLDPWD(\[(?!\d+\])|\+=\(|=\(\[)/.test(word) || (index < at && /^OLDPWD(\[|=\()/.test(word)))) return OLDPWD_UNKNOWN;
		if (command.words.some((word, index) => named(index) && !(declares ? /^[-+]/ : /^-|^[^=]*$/).test(word) && !/^[A-Za-z_]\w*(\+?=|$)/.test(word)) || command.dynamic?.some(named) || words.some((word, index) => /^(?:HOME|ARTHUR_JOB|PWD)(?:\[[^\]]*\])?\+?=/.test(word) && (at < 0 || (index < at && verb !== "git") || declares))) return OLDPWD_UNKNOWN;
		const redirected = theirs(command.writes.map((word) => literal(here(word))));
		if (!moved && redirected === undefined && dirs.length > 0) return run(["("]) ?? ((cwd = dirs.reduce(located, cwd)), judge({ ...command, words: raw, stdin: command.stdin.map((text) => text.replaceAll("\0+", subshells.at(-1)![0])), writes: [] }, true)) ?? run([")"]);
		const moves = ["cd", "pushd", "popd"].includes(verb);
		const args = words.slice(at + 1);
		// An assignment (`=`, `+=`, to `OLDPWD[0]`, or a list `OLDPWD=(a …)` for `a`) alone or by `export`, `declare` or `readonly` sets OLDPWD as written, an `unset` but `-f` clears it, neither once read-only, and a `local` naming it makes it unknown (`\0`), in a function's body or at the top, where bash refuses it; one before `cd` sets it for that `cd` (which then sets the folder it left), one before a shell or `eval` for what they run, a child shell's writable again. Config the guard does not read (`UNREAD`) set so, or by `local`, counts as set before every git call after it, even past the end of a subshell that set it.
		if (at < 0 || ["export", "declare", "typeset", "readonly", "local"].includes(verb)) configured.push(...words.filter((word) => UNREAD.test(word)));
		for (const set of command.alone && !fixed && (at < 0 || moves || ["export", "declare", "typeset", "readonly"].includes(verb)) ? command.words.map((word) => /^OLDPWD(?:\[0+\])?(\+?)=\(?([^]*)/.exec(word)) : []) if (set) previous = (set[1] ? (previous ?? "") : "") + literal(set[2]!).replace(/^~-(?=\/|$)/, previous || "~-");
		if (command.alone && !fixed && verb === "unset" && words.some((word) => /^OLDPWD(\[0+\])?$/.test(word)) && !words.some((word) => /^-\w*f/.test(word))) previous = undefined;
		if (verb === "local" && args.some((word) => /^OLDPWD(?!\w)/.test(word))) previous = "\0";
		if (command.alone && (verb === "readonly" || (["declare", "typeset"].includes(verb) && args.some((word) => /^-\w*r/.test(word)))) && !args.some((word) => /^-\w*f/.test(word)) && args.some((word) => /^OLDPWD(?!\w)/.test(word))) fixed = true;
		if (redirected !== undefined || at < 0 || (moves && !command.alone)) return redirected;
		const operands = args.filter((word) => !word.startsWith("-"));
		if (moves) {
			// `cd -` goes back, a `pushd` alone swaps the folder with the stack's top; with nowhere to go it fails and stays. With `-n` only the stack changes: `pushd -n dir` puts `dir` under its top, `popd -n` drops the one there.
			const dir = args.find((word) => word === "-" || !word.startsWith("-"));
			if (dir === "-" && previous?.includes("\0")) return OLDPWD_UNKNOWN;
			if (verb !== "cd" && args.includes("-n")) return void (verb === "popd" ? pushed.pop() : dir === undefined || pushed.push(located(cwd, dir)));
			const to = verb === "popd" || (verb === "pushd" && dir === undefined) ? pushed.pop() : dir === "-" ? previous : (dir ?? process.env.HOME);
			if (to === undefined) return undefined;
			if (verb === "pushd") pushed.push(cwd);
			[previous, cwd] = [fixed ? previous : cwd, located(cwd, to)];
		} else if (SHELLS.includes(verb)) {
			const flag = args.findIndex((word) => /^-[a-z]*c[a-z]*$/.test(word));
			return (flag >= 0 ? [args[flag + 1] ?? ""] : operands.length === 0 ? command.stdin : []).map((text) => run(["(", { ...command, words: command.words.slice(0, at), alone: true }]) ?? ((fixed = false), run([...parse(text.replaceAll("\0+", cwd)), ")"]))).find(Boolean);
		} else if (verb === "eval") {
			// Bash puts back the OLDPWD a prefix replaced once `eval` ends, whatever its `cd`s set.
			const [kept, found] = [previous, run([{ ...command, words: command.words.slice(0, at), alone: true }, ...parse(args.join(" "))])];
			if (words.slice(0, at).some((word) => /^OLDPWD\+?=/.test(word))) previous = kept;
			return found;
		} else if (verb === "git") return git(args, [...configured, ...words.slice(0, at)]);
		else if (verb === "find") return find(args);
		else if (WRITES.includes(verb) || (["sed", "perl"].includes(verb) && args.some((word) => /^-[a-zA-Z]*i|^--in-place/.test(word)))) return theirs(args);
		else if (COPIES.includes(verb)) return theirs([operands.at(-1) ?? "", ...args.filter((word) => word.startsWith("--target-directory")), ...args.filter((_, index) => args[index - 1] === "-t")]);
		else if (verb === "dd") return theirs(args.filter((word) => word.startsWith("of=")));
		else if (verb === "ln") {
			// A link's target is read from the link's folder: the last operand, or where it is made when it names a folder.
			const link = operands.length > 1 ? located(cwd, operands.at(-1)!) : cwd;
			const folder = statSync(link, { throwIfNoEntry: false })?.isDirectory() ? link : dirname(link);
			return theirs(operands) ?? (args.some((word) => /^-[a-zA-Z]*s|^--symbolic$/.test(word)) ? theirs(operands.slice(0, Math.max(1, operands.length - 1)), folder) : undefined);
		}
	};
	// `find <roots> … -delete`, and `-exec`/`-execdir`/`-ok`/`-okdir <command> {} ;`, that command with the roots for `{}`.
	const find = (args: readonly string[]): string | undefined => {
		const expression = args.findIndex((word) => word.startsWith("-") || word === "(" || word === "!");
		const roots = expression === 0 || args.length === 0 ? ["."] : args.slice(0, expression < 0 ? args.length : expression);
		return args.map((word, index) => {
			const close = args.findIndex((other, position) => position > index && (other === ";" || other === "+"));
			const words = args.slice(index + 1, close < 0 ? args.length : close).flatMap((other) => (other.includes("{}") ? roots.map((root) => other.replaceAll("{}", root)) : [other]));
			return word === "-delete" ? theirs(roots) : ["-exec", "-execdir", "-ok", "-okdir"].includes(word) ? judge({ words, writes: [], reads: [], stdin: [], alone: false }) : undefined;
		}).find(Boolean);
	};
	const git = (args: readonly string[], assignments: readonly string[]): string | undefined => {
		const { sub, rest, chdirs, trees, writesCheckout, writesOperands, config, points, replaces, shared, adds, alias, unread } = gitCall(args, assignments);
		if (unread || config?.loads) return UNSEEN;
		if (sub === "stash" && !["list", "show"].includes(rest[0] ?? "")) return STASH;
		const dir = chdirs.reduce(located, cwd);
		// Every worktree shares the repository: a ref the job does not own, a checkout pointed at it, a replacement or a rewrite is main's.
		const ref = rest.filter((word, at) => !word.startsWith("-") && rest[at - 1] !== "-m")[0] ?? "--stdin";
		if (sub === "update-ref" && ref !== "HEAD" && (place.branch === "" || ref !== `refs/heads/${place.branch}`)) return refusal(place, place.root, `git update-ref ${ref}`);
		if ((points !== undefined && points !== `refs/heads/${place.branch}`) || replaces || shared || adds.some((word) => !inside(located(dir, word), place.worktrees))) return refusal(place, place.root, ["git", sub, ...rest].join(" "));
		// Config the worktrees share runs hooks and programs in the main checkout; a worktree's own, or a file elsewhere, does not.
		if (config?.file !== undefined) return theirs([config.file], dir);
		if (config !== undefined && config.scope !== "--worktree") return refusal(place, place.root, ["git config", config.scope, config.key].filter(Boolean).join(" "));
		const tree = writesCheckout || config !== undefined ? (theirs([dir], dir, false) ?? theirs(trees, dir, false) ?? [dir, ...trees].flatMap((path) => linkedFolders(located(dir, path)).map((folder) => refusal(place, real(folder), `${path}, a link to ${folder}`, false))).find(Boolean)) : undefined;
		return tree ?? (writesOperands ? theirs(rest, dir) : undefined) ?? (alias === undefined ? undefined : git(alias, assignments));
	};
	return run(parse(command));
}

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

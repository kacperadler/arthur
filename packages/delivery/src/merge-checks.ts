import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmodSync, type Dirent, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

// The steps `arthur merge` runs on main once the branch is in (spec/roadmap.md, entry 54): the project's install, as the
// projects plugin answers `projects.install` for the merge commit, the one a new worktree gets, then the `check` and `test`
// scripts main's package.json declares, as `npm run check` and `npm test`, each on the PATH the nvm plugin answers
// `nvm.path` for main's checkout, the one a worktree there gets. docs/commands/merge.md, "Checks on main".

// A step's `install` marks an install that ran. `Ask` is what other plugins answer for the project: `install`, its install at a
// commit (`projects.install`), "" none; `path`, the PATH of its checkout (`nvm.path`), "" the PATH as it is.
export type Step = { readonly command: string; readonly result: string; readonly install?: true };
type Ask = { readonly install: (commit: string) => string; readonly path: () => string };
// Runs one step's command in main's checkout with `env`, as `stepRunner` makes it.
type Run = (command: string, env: NodeJS.ProcessEnv) => SpawnSyncReturns<string>;
// Up to 64 MiB of a step's output is read, a whole test run's.
const MAX_BUFFER = 64 * 2 ** 20;

// How the steps of one merge run in `root` (AR0373): each in the sandbox `sandbox` starts it in (`host.sandbox`, AR0449) and a transient scope of its own
// under the jobs' slice `slice`, as a job runs, stopped once the step ended, so what its scripts leave behind is killed; with no
// user manager to make one (the probe's systemd-run fails), out of a scope, which one `uncapped:` line says. A step still running
// `limitSeconds` after it started is killed (SIGKILL) and fails, `timed out after <n> s` its error (AR0374). After each step,
// passed or failed, every `.git` below the checkout's top that was not there, the same, before the first is removed, one line each (AR0463).
export function stepRunner(root: string, slice: string, sandbox: (command: string) => [string, string[]], log: (line: string) => void, limitSeconds: number): Run {
	const scope = (unit: string) => ["--user", "--scope", "--quiet", "--collect", `--slice=${slice}.slice`, `--unit=${unit}`, "-p", "KillSignal=SIGKILL", "--"];
	const probe = spawnSync("systemd-run", [...scope(`arthur-merge-${process.pid}-0.scope`), "true"], { encoding: "utf8" });
	const bare = probe.error?.message ?? (probe.status === 0 ? undefined : probe.stderr.trim().split("\n")[0] || `systemd-run exited ${probe.status ?? probe.signal}`);
	if (bare !== undefined) log(`uncapped: no systemd scope (${bare}); the steps run bare, outside the jobs' slice, and what they leave behind is not killed`);
	const before = repositories(root);
	let count = 0;
	const ran = (command: string, env: NodeJS.ProcessEnv) => {
		const options = { cwd: root, env, encoding: "utf8", maxBuffer: MAX_BUFFER, timeout: limitSeconds * 1000, killSignal: "SIGKILL" } as const;
		const unit = `arthur-merge-${process.pid}-${++count}.scope`;
		try {
			const spawned = bare !== undefined ? spawnSync(...sandbox(command), options) : spawnSync("systemd-run", [...scope(unit), ...sandbox(command).flat()], options);
			return (spawned.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT" ? { ...spawned, error: new Error(`timed out after ${limitSeconds} s`) } : spawned;
		} finally {
			if (bare === undefined) spawnSync("systemctl", ["--user", "stop", unit], { stdio: "ignore" });
		}
	};
	return (command, env) => {
		const result = ran(command, env);
		for (const [path, seen] of repositories(root)) {
			if (before.get(path) === seen) continue;
			const failure = remove(join(root, path));
			log(failure === "" ? `removed ${path}, which ${command} left: a git call in that folder would run its config outside any sandbox` : `${path}, which ${command} left, could not be removed (${failure}): a git call in that folder would run its config outside any sandbox`);
		}
		return result;
	};
}

// Each `.git` below the checkout's top by its path from `root`, stamped; not walked: the checkout's own, a `.git`'s inside, a symlink's target.
function repositories(root: string): Map<string, string> {
	const found = new Map<string, string>();
	const folders = [root];
	for (let folder = folders.pop(); folder !== undefined; folder = folders.pop()) {
		for (const entry of entries(folder)) {
			const path = join(folder, entry.name);
			if (entry.name !== ".git") {
				if (entry.isDirectory()) folders.push(path);
			} else if (folder !== root) found.set(relative(root, path), stamp(path));
		}
	}
	return found;
}

// A `.git` by the inode, owner, group, mode and change time, which a write, a rename, a chmod, a chgrp or an ACL sets and no step
// can set back, of itself and, in a folder, of every entry below it, so a step's write in one there before (its `config`, a hook)
// counts too; "unreadable" for one a step closed. What a git read changes there does not count (AR0467): an `index` (`git status`
// rewrites one, a linked worktree's in `worktrees/<name>/`) and its `sharedindex.<hash>` (`core.splitIndex`), which run nothing,
// and the change time of each folder git locks an index in (the `.git` folder, one holding an `index`), which the lock file it
// makes and removes sets; their extended attributes, an ACL among them, count instead, read by python3, else their change time.
const READ = /^(index|sharedindex\.[0-9a-f]+)$/;
const ATTRIBUTES = "import os, sys\nfor p in sys.argv[1:]: print(p, sorted((n, os.getxattr(p, n, follow_symlinks=False).hex()) for n in os.listxattr(p, follow_symlinks=False)))";
function stamp(path: string): string {
	try {
		const folder = lstatSync(path).isDirectory();
		const names = folder ? readdirSync(path, { recursive: true, encoding: "utf8" }).sort() : [];
		const locks = folder ? ["", ...names.filter((name) => basename(name) === "index").map((name) => relative(".", dirname(name)))] : [];
		const read = folder ? spawnSync("python3", ["-I", "-c", ATTRIBUTES, ...locks.map((name) => join(path, name))], { encoding: "utf8" }) : undefined;
		const held = new Set(read?.status === 0 ? locks : []);
		const stats = ["", ...names].filter((name) => !READ.test(basename(name))).map((name) => [name, lstatSync(join(path, name))] as const);
		const lines = stats.map(([name, stat]) => `${name} ${stat.ino} ${stat.uid} ${stat.gid} ${stat.mode} ${held.has(name) ? "" : stat.ctimeMs}`);
		return [read?.status === 0 ? read.stdout : "", ...lines].join("\n");
	} catch {
		return "unreadable";
	}
}

// A folder a step made unreadable is made readable for its owner first, so no `.git` hides in it; one that stays so a step never wrote.
function entries(folder: string): Dirent[] {
	try {
		return readdirSync(folder, { withFileTypes: true });
	} catch {
		spawnSync("chmod", ["u+rwx", folder], { stdio: "ignore" });
	}
	try {
		return readdirSync(folder, { withFileTypes: true });
	} catch {
		return [];
	}
}

// "" once `path` is gone, its owner's write given back first, of the folder it is in and of each one in it (never through a
// symlink), since a step may have taken it away; else why it stays.
function remove(path: string): string {
	spawnSync("chmod", ["u+rwx", dirname(path)], { stdio: "ignore" });
	if (lstatSync(path, { throwIfNoEntry: false })?.isDirectory()) spawnSync("chmod", ["-R", "u+rwx", path], { stdio: "ignore" });
	try {
		rmSync(path, { recursive: true, force: true });
		return "";
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

// Each step in order, its output's last 20 lines printed when it fails; no PATH, a failed install or a broken package.json ends them.
export function mainChecks(root: string, ask: Ask, run: Run, log: (line: string) => void): Step[] {
	const { env, steps } = installed(ask, run, log);
	if (steps.some(failed)) return steps;
	const path = join(root, "package.json");
	let parsed: unknown = {};
	try {
		if (existsSync(path)) parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		const result = `failed, not JSON (${error instanceof Error ? error.message : String(error)}).`;
		log(`package.json: ${result}`);
		return [...steps, { command: "package.json", result }];
	}
	const scripts: Readonly<Record<string, unknown>> = typeof parsed === "object" && parsed !== null && "scripts" in parsed && typeof parsed.scripts === "object" && parsed.scripts !== null ? Object.fromEntries(Object.entries(parsed.scripts)) : {};
	const checks = [typeof scripts.check === "string" ? "npm run check" : "", typeof scripts.test === "string" ? "npm test" : ""].filter(Boolean);
	return [...steps, ...checks.map((command) => step(run, command, env, log))];
}

export const failed = (each: Step): boolean => each.result.startsWith("failed");

// After main was reset: main's own install run again, on main's own PATH, when the failed run had run the merge commit's; by
// `runner` over a fresh cache folder in `folder`, removed after it (AR0469): the branch's install wrote the merge's own.
export function reinstall(ask: Ask, runner: (cache: string) => Run, folder: string, steps: readonly Step[], log: (line: string) => void): string {
	if (!steps.some((each) => each.install)) return "";
	const cache = mkdtempSync(join(folder, "cache-"));
	try {
		const again = installed(ask, runner(cache), log, "reinstall of main's dependencies, ").steps;
		return again.some(failed) ? `, but reinstalling main's dependencies failed (${again.filter(failed).map((each) => each.command).join(", ")}): they still hold the branch's install` : "";
	} finally {
		rmSync(cache, { recursive: true, force: true });
	}
}

// Main's environment, its PATH `ask.path` when not "", and the install of its HEAD as a step, none for ""; an answer that throws
// (nvm's Node not installed, two lockfiles, no provider) is a failed step, `node` or `install`, that ran nothing.
function installed(ask: Ask, run: Run, log: (line: string) => void, prefix = ""): { readonly env: NodeJS.ProcessEnv; readonly steps: Step[] } {
	let [env, command] = [process.env, "node"];
	try {
		const PATH = ask.path();
		if (PATH !== "") env = { ...env, PATH };
		command = "install";
		const install = ask.install("HEAD");
		return { env, steps: install === "" ? [] : [{ ...step(run, install, env, log, prefix), install: true }] };
	} catch (error) {
		const result = `failed, ${error instanceof Error ? error.message : String(error)}.`;
		log(`${prefix}${command}: ${result}`);
		return { env, steps: [{ command, result }] };
	}
}

// `passed.`, `12/12 passed.` or `failed, 11/12 passed.`: the counts from node --test's last summary, when it printed one.
function step(run: Run, command: string, env: NodeJS.ProcessEnv, log: (line: string) => void, prefix = ""): Step {
	const ran = run(command, env);
	const out = [ran.stdout, ran.stderr, ran.error?.message].filter(Boolean).join("\n");
	const [total, pass] = [/^\S+ tests (\d+)$/gm, /^\S+ pass (\d+)$/gm].map((pattern) => [...out.matchAll(pattern)].at(-1)?.[1]);
	const count = total !== undefined && pass !== undefined ? `${pass}/${total} passed` : "";
	const result = ran.status === 0 ? `${count || "passed"}.` : `failed${count ? `, ${count}` : ""}${ran.status === null && ran.error !== undefined ? `, ${ran.error.message}` : ""}.`;
	log(`${prefix}${command}: ${result}`);
	if (ran.status !== 0) log(out.trimEnd().split("\n").slice(-20).join("\n"));
	return { command, result };
}

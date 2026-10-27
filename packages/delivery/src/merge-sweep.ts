import { spawnSync } from "node:child_process";
import { type Dirent, lstatSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

// The sweep after each step `arthur merge` runs on main (merge-checks.ts, AR0463, AR0466): every repository below the checkout's
// top that a step left is removed, so no git call there runs its config outside any sandbox. docs/commands/merge.md, "Checks on main".

// Each repository `before` (`repositories(root, () => true)` before the first step) does not hold, the same, after `command`
// ran: removed, one line each to `log`.
export function sweep(root: string, before: ReadonlyMap<string, string>, command: string, log: (line: string) => void): void {
	for (const [path, seen] of repositories(root, escapes)) {
		if (before.get(path) === seen) continue;
		const failure = remove(join(root, path));
		log(failure === "" ? `removed ${path}, which ${command} left: a git call in that folder would run its config outside any sandbox` : `${path}, which ${command} left, could not be removed (${failure}): a git call in that folder would run its config outside any sandbox`);
	}
}

// Each repository below the checkout's top by its path from `root`, stamped: a `.git`; a folder holding a `HEAD`, which git takes
// as a Git folder whatever its name; a symlink `counts` (AR0466): every one before the first step, so one there then and the same
// stays whatever its target became, one that `escapes` after a step. Not walked: the checkout's own `.git`, a repository's inside, a symlink's target.
export function repositories(root: string, counts: (top: string, link: string) => boolean): Map<string, string> {
	const found = new Map<string, string>();
	const top = realpathSync(root);
	const folders = [root];
	for (let folder = folders.pop(); folder !== undefined; folder = folders.pop()) {
		const listed = entries(folder);
		if (folder !== root && listed.some((entry) => entry.name === "HEAD")) {
			found.set(relative(root, folder), stamp(folder));
			continue;
		}
		for (const entry of listed) {
			const path = join(folder, entry.name);
			if (entry.name === ".git") {
				if (folder !== root) found.set(relative(root, path), stamp(path));
			} else if (entry.isDirectory()) folders.push(path);
			else if (entry.isSymbolicLink() && counts(top, path)) found.set(relative(root, path), stamp(path));
		}
	}
	return found;
}

// Whether a git call through the symlink `link` would look for a repository where the sweep does not walk: its target is a folder
// outside the checkout's real top `top`, or in its `.git`. A dangling one is judged by its nearest existing folder and the rest of
// its path, as a folder may come there later; one to a file stays, as no git call runs in it (a venv's `python`).
function escapes(top: string, link: string): boolean {
	let rest = "";
	for (let path = resolve(dirname(link), readlinkSync(link)); ; [path, rest] = [dirname(path), join(basename(path), rest)]) {
		let real: string;
		try {
			real = realpathSync(path);
		} catch {
			continue;
		}
		if (rest === "" && !statSync(real).isDirectory()) return false;
		const first = relative(top, join(real, rest)).split(sep)[0];
		return first === ".." || first === ".git";
	}
}

// A repository by the inode, owner, group, mode and change time, which a write, a rename, a chmod, a chgrp or an ACL sets and no step
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

// A folder a step made unreadable is made readable for its owner first, so no repository hides in it; one that stays so a step never wrote.
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

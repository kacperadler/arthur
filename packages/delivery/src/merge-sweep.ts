import { spawnSync } from "node:child_process";
import { type Dirent, existsSync, lstatSync, readdirSync, readlinkSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

// The sweep after each step `arthur merge` runs on main (merge-checks.ts, AR0463, AR0466): every repository below the checkout's
// top that a step left is removed, so no git call there runs its config outside any sandbox. docs/commands/merge.md, "Checks on main".

// What the sweep holds as the owner's own (AR0490): each repository below main's checkout `root` as it is now, before `git merge`
// (stepRunner), so what the branch commits is a step's to the sweep, every symlink there one, and the folders a step writes: the
// checkout's `.git`, the temporary folder and `/dev`, as the step's sandbox has them (`host.sandbox`), and `writes` (the merge's caches), each by its real path.
type Owned = { readonly repositories: ReadonlyMap<string, string>; readonly writes: readonly string[] };
export function owned(root: string, writes: readonly string[]): Owned {
	const places = [join(realpathSync(root), ".git"), ...[tmpdir(), "/dev", ...writes].map((folder) => realpathSync(folder))];
	return { repositories: repositories(root, () => true, places), writes: places };
}

// Each repository `owner` does not hold, the same, after `command` ran, read once more first where python3 failed (AR0479): removed,
// one line each to `log`, saying so where python3 failed on one there before, or where a symlink's target a step writes was unread.
export function sweep(root: string, owner: Owned, command: string, log: (line: string) => void): void {
	for (const [path, seen] of [...repositories(root, escapes, owner.writes)].map(([path, first]) => [path, first.startsWith(UNREAD) ? stamp(join(root, path)) : first] as const)) {
		const before = owner.repositories.get(path);
		if (before === seen && !seen.endsWith(UNSEEN)) continue;
		const failure = remove(join(root, path));
		const why = seen.endsWith(UNSEEN) ? "its target, in a folder a step writes, could not be read, so a repository there could not be told from the owner's own" : before !== undefined && [before, seen].some((one) => one.startsWith(UNREAD)) ? "python3 failed to read the extended attributes of its Git folders, so a git read there could not be told from a change" : "a git call in that folder would run its config outside any sandbox";
		log(`${failure === "" ? `removed ${path}, which ${command} left` : `${path}, which ${command} left, could not be removed (${failure})`}: ${why}`);
	}
}

// Each repository below the checkout's top by its path from `root`, stamped: a `.git`; a folder holding a `HEAD`, which git takes
// as a Git folder whatever its name; a symlink `counts` (AR0466): every one before `git merge`, so one there then and the same
// stays whatever its target became, unless it leads into a folder a step writes, `writes` (`linked`); one that `escapes` after a
// step. Not walked: the checkout's own `.git`, a repository's inside, a symlink's target.
function repositories(root: string, counts: (top: string, link: string) => boolean, writes: readonly string[]): Map<string, string> {
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
				if (folder !== root) found.set(relative(root, path), entry.isSymbolicLink() ? linked(path, writes) : stamp(path));
			} else if (entry.isDirectory()) folders.push(path);
			else if (entry.isSymbolicLink() && counts(top, path)) found.set(relative(root, path), linked(path, writes));
		}
	}
	return found;
}

// Whether a git call through the symlink `link` would look for a repository where the sweep does not walk: its target is a folder
// outside the checkout's real top `top`, or in its `.git`; one to a file stays, as no git call runs in it (a venv's `python`).
function escapes(top: string, link: string): boolean {
	const { path, folder } = target(link);
	const first = relative(top, path).split(sep)[0];
	return folder && (first === ".." || first === ".git");
}

// Where the symlink `link` leads, as the kernel follows it from its folder's real path (AR0490): its target's real path, a
// dangling one's nearest existing folder's joined with the rest of its path, as a folder may come there later; and whether a folder may be there.
function target(link: string): { readonly path: string; readonly folder: boolean } {
	let rest = "";
	for (let path = resolve(realpathSync(dirname(link)), readlinkSync(link)); ; [path, rest] = [dirname(path), join(basename(path), rest)]) {
		let real: string;
		try {
			real = realpathSync(path);
		} catch {
			continue;
		}
		return { path: join(real, rest), folder: rest !== "" || statSync(real).isDirectory() };
	}
}

// A symlink by its own stamp and, where it leads into a folder of `writes`, by its target's too (AR0490), "missing" while none is
// there, so a step that puts a repository there, in place of a file or in a folder, changes it; `UNSEEN` for a target it cannot read.
const UNSEEN = "target unread";
function linked(link: string, writes: readonly string[]): string {
	const { path } = target(link);
	if (!writes.some((folder) => path === folder || path.startsWith(`${folder}${sep}`))) return stamp(link);
	const seen = existsSync(path) ? stamp(path) : "missing";
	return `${stamp(link)}\n${seen === "unreadable" ? UNSEEN : seen}`;
}

// A repository by the inode, owner, group, mode and change time, which a write, a rename, a chmod, a chgrp or an ACL sets and no step
// can set back, of itself and, in a folder, of every entry below it, so a step's write in one there before (its `config`, a hook)
// counts too; "unreadable" for one a step closed. What a git read changes there does not count (AR0467): an `index` (`git status`
// rewrites one, a linked worktree's in `worktrees/<name>/`) and its `sharedindex.<hash>` (`core.splitIndex`), which run nothing,
// and the change time of each folder git locks an index in (the `.git` folder, one holding an `index`), which the lock file it
// makes and removes sets; their extended attributes, an ACL among them, count instead, read by python3, else (`UNREAD` first) their change time.
const [READ, UNREAD] = [/^(index|sharedindex\.[0-9a-f]+)$/, "python3 failed"];
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
		return [read === undefined ? "" : read.status === 0 ? read.stdout : UNREAD, ...lines].join("\n");
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

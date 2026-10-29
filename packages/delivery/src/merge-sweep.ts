import { spawnSync } from "node:child_process";
import { type Dirent, existsSync, lstatSync, readdirSync, readlinkSync, realpathSync, rmSync, type Stats, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";

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

// Where the symlink `link` leads, as the kernel follows it from its folder's real path, part by part (AR0490): each symlink on
// the way, `link` first, a folder's too, by its path, and where it ends: a real path, or a dangling one's nearest existing folder's
// joined with the rest of its path, as a folder may come there later, or, after 40 links, the kernel's limit, the rest unfollowed; and whether a folder may be there.
function target(link: string): { readonly hops: readonly string[]; readonly path: string; readonly folder: boolean } {
	const [hops, rest] = [[] as string[], [basename(link)]];
	let at = realpathSync(dirname(link));
	while (rest.length > 0 && hops.length < 40) {
		const next = join(at, rest[0] ?? "");
		let stat: Stats;
		try {
			stat = lstatSync(next);
		} catch {
			break;
		}
		rest.shift();
		if (!stat.isSymbolicLink()) at = next;
		else {
			hops.push(next);
			const text = readlinkSync(next);
			if (text.startsWith(sep)) at = sep;
			rest.unshift(...text.split(sep).filter(Boolean));
		}
	}
	return { hops, path: join(at, ...rest), folder: rest.length > 0 || statSync(at).isDirectory() };
}

// A symlink by its own stamp and, where it leads into a folder of `writes` or through a symlink there, which a step can point
// elsewhere, by each link's on the way, where it ends and its target's stamp too (AR0490), "missing" while none is there, so a
// step that puts a repository there, in place of a file or in a folder, or points a link on the way at one, changes it; and by the
// `.git` and `HEAD` of each folder above where it ends and above each link, from the folder of `writes` down, where git, walking
// up from its working folder, would find a repository a step made there. `UNSEEN` for a target it cannot read.
const UNSEEN = "target unread";
function linked(link: string, writes: readonly string[]): string {
	const { hops, path } = target(link);
	const inside = (folder: string, each: string) => each === folder || each.startsWith(`${folder}${sep}`);
	const ends = [...hops, path];
	if (!ends.some((each) => writes.some((folder) => inside(folder, each)))) return stamp(link);
	const above = ends.flatMap((each) => writes.filter((folder) => inside(folder, each) && each !== folder).flatMap((folder) => {
		const parents = [dirname(each)];
		while (parents.at(-1) !== folder) parents.push(dirname(parents.at(-1) ?? folder));
		return parents.flatMap((parent) => [".git", "HEAD"].map((name) => join(parent, name)));
	}));
	const seen = existsSync(path) ? stamp(path) : "missing";
	return [...hops.map((hop) => `${hop} ${stamp(hop)}`), ...above.map((each) => `${each} ${present(each) ? stamp(each) : "missing"}`), path, seen === "unreadable" ? UNSEEN : seen].join("\n");
}

// Whether `path` is there, a dangling symlink too; not for one in a folder that cannot be searched, where git would not see it either.
function present(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch {
		return false;
	}
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

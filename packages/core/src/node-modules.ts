import { constants, cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCKFILE = "package-lock.json";

// A new worktree's `node_modules` (spec/roadmap.md, entry 9): the main checkout's, when its lockfile is the job's byte for
// byte; a copy-on-write clone where the filesystem has one. Links stay as they are, so a workspace's link points into the
// job's own worktree.
export function copyNodeModules(root: string, worktree: string): void {
	const modules = join(root, "node_modules");
	const ours = join(root, LOCKFILE);
	const theirs = join(worktree, LOCKFILE);
	if (!existsSync(modules) || !existsSync(ours) || !existsSync(theirs) || !readFileSync(ours).equals(readFileSync(theirs))) return;
	cpSync(modules, join(worktree, "node_modules"), { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
}

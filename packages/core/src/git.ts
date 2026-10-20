import { spawnSync } from "node:child_process";

// The Git a job runner needs (spec/roadmap.md, entries 9 and 11), each one `git` call on the repository at `root`.

// Runs `git -C <root> <args>`; its output with the last newline removed, or an error with what Git said.
function git(root: string, args: readonly string[]): string {
	const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
	if (run.error) throw new Error(`git: ${run.error.message}`);
	if (run.status !== 0) throw new Error(`git ${args[0]}: ${run.stderr.trim() || `exit code ${run.status}`}`);
	return run.stdout.replace(/\n$/, "");
}

// True when the command exits 0; for questions Git answers by its exit code.
function yes(root: string, args: readonly string[]): boolean {
	return spawnSync("git", ["-C", root, ...args], { stdio: "ignore" }).status === 0;
}

// The top folder of the repository `folder` is in; undefined outside Git.
export function topLevel(folder: string): string | undefined {
	return yes(folder, ["rev-parse", "--show-toplevel"]) ? git(folder, ["rev-parse", "--show-toplevel"]) : undefined;
}

// The commit `name` names, HEAD when left out; undefined when it names none (a repository with no commit yet).
export function head(root: string, name = "HEAD"): string | undefined {
	return yes(root, ["rev-parse", "--verify", "--quiet", `${name}^{commit}`]) ? git(root, ["rev-parse", `${name}^{commit}`]) : undefined;
}

// A file, not a folder, at `path` from the top of the repository, in `commit`.
export function fileAt(root: string, commit: string, path: string): boolean {
	const type = spawnSync("git", ["-C", root, "cat-file", "-t", `${commit}:${path}`], { encoding: "utf8" });
	return type.status === 0 && type.stdout.trim() === "blob";
}

export function branchExists(root: string, branch: string): boolean {
	return yes(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
}

// A new worktree at `path` from `commit`: on a new branch, or detached when `branch` is undefined. The checkout at `root`
// keeps its own changes, staged or not.
export function addWorktree(root: string, path: string, commit: string, branch: string | undefined): void {
	git(root, ["worktree", "add", "--quiet", ...(branch === undefined ? ["--detach"] : ["-b", branch]), path, commit]);
}

// Removes the worktree, its changes included, and its branch when it has one.
export function removeWorktree(root: string, path: string, branch: string | undefined): void {
	git(root, ["worktree", "remove", "--force", path]);
	if (branch !== undefined) git(root, ["branch", "--quiet", "-D", branch]);
}

// The commits on `branch` since `base`, newest first, one `<short hash> <subject>` line each.
export function commitsSince(root: string, base: string, branch: string): string {
	return git(root, ["log", "--oneline", `${base}..${branch}`]);
}

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { checkConfig } from "@arthur/core/git-config";
import { takeLock } from "@arthur/core/lock";
import type { Host } from "@arthur/core/plugin";
import { lastMerge } from "./take-main.ts";

// A merge of `project` that died half done (AR0629): its `merge.lock` names a process that is gone, and main's HEAD is still
// its merge commit of the job `merging` names, its checks not passed (`last-merge` is not it) and on no remote branch. Main
// goes back to the merge's first parent with `--keep`, so the board's uncommitted moves stay, and the lock goes. Returns the
// job and the cause of its merge's next run; undefined when nothing went back: no lock, a live holder, a HEAD of another kind,
// or a reset Git refused, which the coordinator is told. docs/commands/merge.md, "On its own".
export function recoverMerge(host: Host, project: string): { readonly job: string; readonly hash: string; readonly why: string } | undefined {
	const own = join(host.folder, project);
	if (!existsSync(join(own, "merge.lock"))) return undefined;
	const lock = takeLock(join(own, "merge.lock"));
	if ("heldBy" in lock) return undefined;
	try {
		const id = existsSync(join(own, "merging")) ? readFileSync(join(own, "merging"), "utf8").trim() : "";
		const job = host.jobs.list().find((each) => each.id === id);
		const root = host.board.projects().find((each) => each.name === project)?.path;
		if (job === undefined || job.branch === "" || root === undefined) return undefined;
		// No program the checkout's own config may name runs (AR0330, AR0380, AR0384), as in `arthur merge`.
		const { refusal, pins } = checkConfig(root);
		if (refusal !== "") return undefined;
		const git = (...words: string[]) => spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...pins, "-C", root, ...words], { encoding: "utf8" });
		const [hash = "", parent = "", second, more] = git("rev-list", "--parents", "-n", "1", "HEAD").stdout.trim().split(" ");
		if (more !== undefined || second !== git("rev-parse", "--verify", "--quiet", `${job.branch}^{commit}`).stdout.trim()) return undefined;
		if (lastMerge(host, project, git)?.hash === hash || git("for-each-ref", "--contains", hash, "refs/remotes").stdout.trim() !== "") return undefined;
		const why = `The merge of ${job.id} on ${project} died half done, its process gone`;
		// Main moves only from the merge commit read above (compare-and-swap), so a commit that landed since stays; the index and
		// files follow as `git reset --keep` would, the board's moves kept, and a local change to a file the merge changed undoes the move.
		if (git("update-ref", "HEAD", parent, hash).status !== 0) return undefined;
		const reset = git("read-tree", "-m", "-u", hash, parent);
		if (reset.status !== 0) {
			git("update-ref", "HEAD", hash, parent);
			const said = (reset.stderr.trim() || reset.stdout.trim()).split("\n").at(-1);
			host.events.emit("coordinator-message", { text: `${why}: main still holds its merge commit ${hash.slice(0, 7)}, as git read-tree -m -u ${hash.slice(0, 7)} ${parent.slice(0, 7)} refused: ${said}; reset main to ${parent.slice(0, 7)} in ${root}, then arthur merge --auto ${job.id}` });
			return undefined;
		}
		rmSync(join(own, "merging"), { force: true });
		return { job: job.id, hash, why: `${why}: main went back from its merge commit ${hash.slice(0, 7)} to ${parent.slice(0, 7)}, the board kept.` };
	} finally {
		lock.release();
	}
}

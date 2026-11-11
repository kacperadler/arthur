import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { checkConfig } from "@arthur/core/git-config";
import { holds, takeLock } from "@arthur/core/lock";
import type { Host } from "@arthur/core/plugin";
import { lastMerge } from "./take-main.ts";

// A merge of `project` that died half done (AR0629): its `merge.lock` names a process that is gone, and main's HEAD is still
// its merge commit of the job `merging` names, its checks not passed (`last-merge` is not it) and on no remote branch. Main
// goes back to the merge's first parent (below), and a dead lock goes with its `merging`, as a merge's own end removes both. Returns the
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
		return { job: job.id, hash, why: `${why}: main went back from its merge commit ${hash.slice(0, 7)} to ${parent.slice(0, 7)}, the board kept.` };
	} finally {
		rmSync(join(own, "merging"), { force: true });
		lock.release();
	}
}

// The merges in a run now, which hold session's restart (AR0691): each project whose `merge.lock` names a live process, with the
// job its `merging` names, "" before the merge wrote it. A lock its process left holds nothing; the next merge or `arthur run` takes it over.
export function merging(host: Host): { readonly project: string; readonly job: string }[] {
	return host.board.projects().flatMap(({ name: project }) => {
		const read = (file: string) => {
			// A file gone between two looks, as at a merge's end, names no merge.
			try {
				return readFileSync(join(host.folder, project, file), "utf8").trim();
			} catch {
				return "";
			}
		};
		const pid = Number(read("merge.lock").split(" ")[0]);
		// A lock naming this process is one it holds only by core's own count: an earlier process of its pid may have left it.
		return (pid === process.pid ? holds(join(host.folder, project, "merge.lock")) : alive(pid)) ? [{ project, job: read("merging") }] : [];
	});
}

// Whether `pid` still runs: a signal 0 it may not receive (EPERM) still names a process; 0, a spawn that failed, names none.
export function alive(pid: number): boolean {
	try {
		return pid > 0 && process.kill(pid, 0);
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

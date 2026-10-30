import { spawnSync } from "node:child_process";
import type { Host, JobRecord } from "@arthur/core/plugin";

// The merge's check of a worker's branch (AR0570, `arthur merge --help`): a ticket, the decision log and the board are
// written on main by the coordinator's own commands (`arthur ticket`, `arthur decision`, the board's), never by a branch. A
// branch whose merge would add, change or delete a `spec/features/*/ticket.md`, `spec/decisions.jsonl` or `spec/build.json`
// on main is refused, each file named; by path only, nothing in them is read.
const PAPERS = /^spec\/(?:features\/[^/]+\/ticket\.md|decisions\.jsonl|build\.json)$/;

export function paperCheck(host: Host): void {
	// Asked by the merge and by `arthur review-needed` with the job as `host.jobs.list()` has it: a reason to refuse, undefined to let it in.
	host.provide("merge.check", (job: Pick<JobRecord, "kind" | "project" | "branch">) => {
		if (job.kind !== "worker") return undefined;
		const root = host.board.projects().find((project) => project.name === job.project)?.path;
		if (root === undefined) return `project ${job.project} is not in the list`;
		// No hook, fsmonitor or replacement a job may have set in the checkout's config runs (AR0330, AR0384).
		const git = (...words: string[]) => spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", root, ...words], { encoding: "utf8" });
		// HEAD against the tree `git merge` would make, every merge base counted (a branch that merged a sibling's has two), a
		// conflicted one too. Its first line is that tree, also on exit 1 (a conflict), which an unknown branch exits with as well.
		const merged = git("merge-tree", "--write-tree", "--no-messages", "HEAD", job.branch);
		const [tree = ""] = merged.stdout.split("\n");
		const diff = /^[0-9a-f]{40,64}$/.test(tree) ? git("diff", "--name-only", "-z", "--no-renames", "HEAD", tree, "--") : { ...merged, status: -1 };
		if (diff.status !== 0) return `cannot tell what merging ${job.branch} changes: ${diff.stderr.trim().split("\n").at(-1)}`;
		const papers = diff.stdout.split("\0").filter((path) => PAPERS.test(path));
		if (papers.length === 0) return undefined;
		return `${job.branch} changes ${papers.join(", ")}, which only the coordinator's arthur ticket, arthur decision and board commands write on main; put each back as main has it on the branch (git checkout <main> -- <file>, or git rm one main lacks) and commit, with what it was for in the ticket's findings.md or the final message`;
	});
}

import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { configRefusal } from "@arthur/core/git-config";
import type { Host } from "@arthur/core/plugin";
import { endHandBack } from "./hand-back.ts";
import { FEATURE } from "./review-command.ts";

// A ticket's jobs freed as `arthur prune` frees them (AR0555), after its merge and when it is dropped: each job of `project`
// whose task names a file of the ticket's folder, and `also`, its hand-back ended. The prune keeps a job in a run, held or
// blocked, a worktree with changes, and a branch main lacks; with `drop`, such a branch of an ended job here goes with `git
// branch -D` (Git refuses one a worktree has) and the job is pruned again, and a job in a run is left to its end (delivery.ts).
export function pruneTicket(host: Host, project: string, ticket: string | undefined, also: readonly string[], drop: boolean): string[] {
	const named = host.jobs.list().filter((job) => job.project === project && ticket !== undefined && job.tickets.some((path) => basename(FEATURE.exec(path)?.[1] ?? "").startsWith(`${ticket}-`)));
	const [all, busy] = [[...new Set([...also, ...named.map((job) => job.id)])], host.jobs.running()];
	for (const id of all) endHandBack(host, id);
	const ids = all.filter((id) => !drop || !busy.includes(id));
	const lines = [...all.filter((id) => !ids.includes(id)).map((id) => `${id}: kept: it is in a run; once it ends, delivery prunes it, its branch too`), ...(ids.length === 0 ? [] : host.jobs.prune(ids))];
	const root = host.board.projects().find((each) => each.name === project)?.path;
	const left = drop ? host.jobs.list().filter((job) => ids.includes(job.id) && job.state === "ended" && job.branch !== "" && job.machine === "local") : [];
	if (root === undefined || left.length === 0) return lines;
	const planted = configRefusal(root);
	if (planted !== "") return [...lines, `kept every unmerged branch: ${planted}`];
	// No hook or fsmonitor the checkout's config names runs, nor a replacement (refs/replace): a program a job runs may have set them (AR0330, AR0384).
	const forced = left.filter((job) => spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", root, "branch", "--quiet", "-D", job.branch]).status === 0);
	return [...lines, ...forced.map((job) => `${job.branch} deleted, not merged: ${ticket} is dropped`), ...(forced.length === 0 ? [] : host.jobs.prune(forced.map((job) => job.id)))];
}

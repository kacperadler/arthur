import { spawnSync } from "node:child_process";
import { matchesGlob } from "node:path";
import type { Host, JobRecord } from "@arthur/core/plugin";
import { type CiRun, startWait } from "./ci-wait.ts";
import { noReview, reviewsOf } from "./review-records.ts";

// `arthur merge --auto` (spec/roadmap.md, entry 59): the merge without the owner, only for a project with `autoMerge` on, a
// PASS (or `no review` and no other review of it) on the tip itself, no held path in the branch, and CI passed on it as `github.ci` answers; never with `--no-ci`, which
// only the owner's decision lifts (AR0503). CI not passed yet leaves a wait (ci-wait.ts). A plain merge asks CI too (AR0362). docs/commands/merge.md.

type Entry = { readonly name: string; readonly autoMerge?: boolean; readonly prompts?: { readonly rolesDir?: string } };
// The project's role overrides when its `prompts` names none, as the core reads them.
const ROLES_DIR = ".agents/arthur/roles";
// The project as the list gives it, with the keys delivery reads that `host.board.projects()` leaves out.
export const entryOf = (host: Host, project: string) => host.collect<readonly Entry[]>("projects")[0]?.find((each) => each.name === project);
// No hook or fsmonitor the main checkout's config names runs, nor a replacement (refs/replace): a program a job runs may have set them (AR0330, AR0384).
const git = (root: string, ...words: string[]) => spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", root, ...words], { encoding: "utf8" }).stdout.trim();

// Why `--auto` may not merge `job`'s `tip` into `main` at `before`, each refusal naming its rule; "" when it may. `held` is
// delivery's always-review list.
export async function autoRefusal(host: Host, held: (path: string) => boolean, merge: { readonly job: JobRecord; readonly root: string; readonly tip: string; readonly before: string }): Promise<string> {
	const { job, root, tip, before } = merge;
	const entry = entryOf(host, job.project);
	if (entry?.autoMerge !== true) return `--auto merges only in a project with autoMerge on; ${job.project} has autoMerge ${entry?.autoMerge ?? "unset"}, so its merges wait for the owner: arthur merge ${job.id} on his word`;
	const reviews = reviewsOf(host, job.branch);
	const onTip = reviews.findLast(([review, verdict]) => tip.startsWith(review.commit) && (verdict === "PASS" || verdict === "FAIL"));
	const ofTip = reviews.findLast(([review]) => tip.startsWith(review.commit));
	if (onTip?.[1] !== "PASS" && (ofTip !== undefined || !noReview(host, job.id, tip))) {
		const pass = reviews.findLast(([, verdict]) => verdict === "PASS")?.[0];
		const why = onTip !== undefined ? `its newest review, ${onTip[0].id}, says FAIL` : ofTip !== undefined ? `its review ${ofTip[0].id} has no verdict` : pass !== undefined ? `the last PASS, ${pass.id}, is on an older commit, ${pass.commit.slice(0, 7)}` : "no review of it says PASS";
		return `--auto merges only with a PASS on the tip: ${job.branch}'s tip ${tip.slice(0, 7)}: ${why}; review the tip: arthur review ${job.id}`;
	}
	const rules: readonly (readonly [string, readonly string[]])[] = [
		["a role", ["**/roles/**", `${entry?.prompts?.rolesDir ?? ROLES_DIR}/**`]],
		["the vision", [host.jobs.vision(job.project).path]],
		["CI", [".github/workflows/**"]],
		["package.json", ["**/package.json"]],
	];
	// Both names of a renamed file count.
	for (const path of git(root, "diff", "--no-renames", "--name-only", `${before}...${tip}`).split("\n").filter(Boolean)) {
		const rule = rules.find(([, globs]) => globs.some((glob) => matchesGlob(path, glob)))?.[0] ?? (held(path) ? "the always-review list" : undefined);
		if (rule !== undefined) return `--auto merges no held path: ${job.branch} changes ${path} (${rule}); its merge waits for the owner: arthur merge ${job.id} on his word`;
	}
	return ciRefusal(host, merge, true);
}

// Why CI keeps `tip` out, "" when it may go in: for `--auto` (`auto`) CI passed on the tip itself, `run.sha` the `tip` read here
// whatever `below` github counts (AR0437), a run not ended or none on the tip leaving a wait (AR0359); a plain merge only a run
// on the branch's own commits that ended other than `success`, and waits for nothing (AR0362).
export async function ciRefusal(host: Host, { job, root, tip, before }: { readonly job: JobRecord; readonly root: string; readonly tip: string; readonly before: string }, auto: boolean): Promise<string> {
	let asked: Promise<CiRun | undefined>;
	try {
		asked = host.call<Promise<CiRun | undefined>>("github.ci", { project: job.project, branch: job.branch });
	} catch (error) {
		return auto ? `--auto asks CI of github, which is not loaded (${(error as Error).message}); without it, only the owner's decision merges: arthur merge ${job.id} --no-ci --decision <the owner's decision id>` : "";
	}
	const rule = `${auto ? "--auto" : "arthur merge"} merges only with CI passed on the branch`;
	let run: CiRun | undefined;
	try {
		run = await asked;
	} catch (error) {
		return auto ? `${rule}: github could not tell: ${(error as Error).message}` : "";
	}
	const own = Number(git(root, "rev-list", "--first-parent", "--count", `${before}..${tip}`));
	if (!auto && (run === undefined || run.below >= own || run.status !== "completed")) return "";
	const waits = "; it waits: when that run ends, the coordinator is woken with its verdict";
	if (run === undefined || run.below !== 0 || (auto && run.sha !== tip)) {
		startWait(host, { job: job.id, project: job.project, branch: job.branch, tip, own });
		const nearest = run === undefined ? "" : ` (the nearest, ${run.id}, ran on ${run.sha.slice(0, 7)}, ${run.below === 0 ? `not the tip ${tip.slice(0, 7)}` : `${run.below} below the tip`})`;
		return `${rule}: no run built the tip yet${nearest}${waits}`;
	}
	const where = `run ${run.id}, attempt ${run.attempt}, on ${run.sha.slice(0, 7)}${run.below === 0 ? ", the tip" : `, ${run.below} below the tip`}`;
	if (run.status !== "completed") {
		startWait(host, { job: job.id, project: job.project, branch: job.branch, tip, own });
		return `${rule}: ${where}, is ${run.status}${waits}`;
	}
	if (run.conclusion !== "success") return `${rule}: ${where}, ended ${run.conclusion}: ${run.url}; why: arthur ci ${job.branch} --project ${job.project}${auto ? "" : `; or merge it with --no-ci --decision <the owner's decision id>`}`;
	return "";
}

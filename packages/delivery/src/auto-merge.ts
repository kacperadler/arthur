import { spawnSync } from "node:child_process";
import { matchesGlob } from "node:path";
import type { Host, JobRecord } from "@arthur/core/plugin";
import { type CiRun, startWait } from "./ci-wait.ts";
import { reviewsOf } from "./review-records.ts";

// `arthur merge --auto` (spec/roadmap.md, entry 59): the merge without the owner, only for a project with `autoMerge` on, a
// PASS on the tip itself, no held path in the branch, and CI passed on it as `github.ci` answers; `--no-ci`, on the owner's
// word, leaves CI out. CI not passed yet leaves a wait (ci-wait.ts). docs/commands/merge.md, "--auto".

type Entry = { readonly name: string; readonly autoMerge?: boolean; readonly prompts?: { readonly rolesDir?: string } };
// The project's role overrides when its `prompts` names none, as the core reads them.
const ROLES_DIR = ".agents/arthur/roles";
// The project as the list gives it, with the keys delivery reads that `host.board.projects()` leaves out.
export const entryOf = (host: Host, project: string) => host.collect<readonly Entry[]>("projects")[0]?.find((each) => each.name === project);

// Why `--auto` may not merge `job`'s `tip` into `main` at `before`, each refusal naming its rule; "" when it may. `held` is
// delivery's always-review list.
export async function autoRefusal(host: Host, held: (path: string) => boolean, merge: { readonly job: JobRecord; readonly root: string; readonly tip: string; readonly before: string; readonly ci: boolean }): Promise<string> {
	const { job, root, tip, before } = merge;
	const entry = entryOf(host, job.project);
	if (entry?.autoMerge !== true) return `--auto merges only in a project with autoMerge on; ${job.project} has autoMerge ${entry?.autoMerge ?? "unset"}, so its merges wait for the owner: arthur merge ${job.id} on his word`;
	const reviews = reviewsOf(host, job.branch);
	const onTip = reviews.findLast(([review, verdict]) => tip.startsWith(review.commit) && (verdict === "PASS" || verdict === "FAIL"));
	if (onTip?.[1] !== "PASS") {
		const pass = reviews.findLast(([, verdict]) => verdict === "PASS")?.[0];
		const why = onTip !== undefined ? `its newest review, ${onTip[0].id}, says FAIL` : pass !== undefined ? `the last PASS, ${pass.id}, is on an older commit, ${pass.commit.slice(0, 7)}` : "no review of it says PASS";
		return `--auto merges only with a PASS on the tip: ${job.branch}'s tip ${tip.slice(0, 7)}: ${why}; review the tip: arthur review ${job.id}`;
	}
	// No hook or fsmonitor the main checkout's config names runs, nor a replacement (refs/replace): a program a job runs may have set them (AR0330, AR0384).
	const git = (...words: string[]) => spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", root, ...words], { encoding: "utf8" }).stdout.trim();
	const rules: readonly (readonly [string, readonly string[]])[] = [
		["a role", ["**/roles/**", `${entry?.prompts?.rolesDir ?? ROLES_DIR}/**`]],
		["the vision", [host.jobs.vision(job.project).path]],
		["CI", [".github/workflows/**"]],
		["package.json", ["**/package.json"]],
	];
	// Both names of a renamed file count.
	for (const path of git("diff", "--no-renames", "--name-only", `${before}...${tip}`).split("\n").filter(Boolean)) {
		const rule = rules.find(([, globs]) => globs.some((glob) => matchesGlob(path, glob)))?.[0] ?? (held(path) ? "the always-review list" : undefined);
		if (rule !== undefined) return `--auto merges no held path: ${job.branch} changes ${path} (${rule}); its merge waits for the owner: arthur merge ${job.id} on his word`;
	}
	if (!merge.ci) return "";
	let asked: Promise<CiRun | undefined>;
	try {
		asked = host.call<Promise<CiRun | undefined>>("github.ci", { project: job.project, branch: job.branch });
	} catch (error) {
		return `--auto asks CI of github, which is not loaded (${(error as Error).message}); without it, only the owner's word merges: arthur merge ${job.id} --auto --no-ci`;
	}
	const rule = "--auto merges only with CI passed on the branch";
	let run: CiRun | undefined;
	try {
		run = await asked;
	} catch (error) {
		return `${rule}: github could not tell: ${(error as Error).message}`;
	}
	const own = Number(git("rev-list", "--first-parent", "--count", `${before}..${tip}`));
	const waits = "; it waits: when that run ends, the coordinator is woken with its verdict";
	if (run === undefined || run.below >= own) {
		startWait(host, { job: job.id, project: job.project, branch: job.branch, tip, own });
		return `${rule}: no run built a commit of it yet${run === undefined ? "" : ` (the nearest, ${run.id}, ran on ${run.sha.slice(0, 7)}, on main)`}${waits}`;
	}
	const where = `run ${run.id}, attempt ${run.attempt}, on ${run.sha.slice(0, 7)}${run.below === 0 ? ", the tip" : `, ${run.below} below the tip`}`;
	if (run.status !== "completed") {
		startWait(host, { job: job.id, project: job.project, branch: job.branch, tip, own });
		return `${rule}: ${where}, is ${run.status}${waits}`;
	}
	if (run.conclusion !== "success") return `${rule}: ${where}, ended ${run.conclusion}: ${run.url}; why: arthur ci ${job.branch} --project ${job.project}`;
	return "";
}

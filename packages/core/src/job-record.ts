import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchExists } from "./git.ts";
import type { Job, Spawn } from "./jobs.ts";

// The job record `<home>/jobs/<id>/` (spec/roadmap.md, entries 9 and 10) as the spawn writes it, one file per key; the
// wrapper (entry 11) adds the files of the run.

// Written into `.<id>` and renamed, so a reader sees all of it or nothing. An empty `branch`, `model`, `thinking` or `quick` is none;
// `prompt` is the role's, which the agent gets; `resume-on-budget` is `true` when the kind asks for one resume at its budget.
// A job starts `working` (job-state.ts) at `since`; `idle-minutes` is the core's `jobs.idleMinutes`; `projects` is every
// project's main checkout, `checkouts` (job-checkout.ts), which the worktree guard refuses too.
export function writeRecord(home: string, job: Job, prompt: string, resumeOnBudget: boolean, idleMinutes: number, since: Date, projects: string): void {
	const folder = join(home, "jobs");
	const temporary = join(folder, `.${job.id}`);
	mkdirSync(temporary, { recursive: true });
	const record = {
		task: job.task, kind: job.kind, project: job.project, model: job.model ?? "", thinking: job.thinking ?? "", quick: job.quick ?? "", prompt,
		timeout: String(job.timeoutMinutes), budget: String(job.budgetUsd), "resume-on-budget": String(resumeOnBudget),
		"idle-minutes": String(idleMinutes), branch: job.branch ?? "", root: job.root, base: job.base, worktree: job.worktree, machine: job.machine, projects,
		reason: "", since: since.toISOString(), state: "working",
	};
	for (const [name, value] of Object.entries(record)) writeFileSync(join(temporary, name), value);
	renameSync(temporary, join(folder, job.id));
}

// A free id, `<date>-<kind>-<8 hex digits>`: no record, worktree or branch of that name exists yet. The worktree goes beside
// `place`, the repository it is added to: `root`, or the project's repository on another machine.
export function newJob(home: string, date: string, spawn: Spawn, root: string, base: string, readOnly: boolean, place: string): Job {
	for (;;) {
		const random = Buffer.from(crypto.getRandomValues(new Uint8Array(4))).toString("hex");
		const id = `${date}-${spawn.kind}-${random}`;
		const branch = readOnly ? undefined : `arthur/${id}`;
		const worktree = join(dirname(place), ".arthur-worktrees", id);
		if (existsSync(join(home, "jobs", id)) || existsSync(worktree) || (branch !== undefined && branchExists(root, branch))) continue;
		return { ...spawn, id, root, base, branch, worktree };
	}
}

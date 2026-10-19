import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { taskTickets } from "./board-jobs.ts";
import { branchExists } from "./git.ts";
import type { Caps } from "./job-scope.ts";
import type { Job, Spawn } from "./jobs.ts";

// The job record `<home>/jobs/<id>/` (spec/roadmap.md, entries 9 and 10) as the spawn writes it, one file per key; the
// wrapper (entry 11) adds the files of the run.

// Written into `.<id>` and renamed, so a reader sees all of it or nothing. An empty `branch`, `model`, `model-why`, `thinking`,
// `quick`, `cpu`, `memory`, `feature`, `feature-cpu` or `feature-memory` is none; `model-why` says why the model was picked from
// its list (job-model.ts); `prompt` is the role's, which the agent gets; `resume-on-budget`
// is `true` when the kind asks for one resume at its budget; the caps are the job's own and its ticket's slice's (job-scope.ts);
// `cost` starts at 0, so a missing one is a broken record; `free` is `true` for a model that costs nothing (job-model.ts).
// A job starts `working` (job-state.ts) at `since`; `idle-minutes` is the core's `jobs.idleMinutes`; `projects` is every
// project's main checkout, `checkouts` (job-checkout.ts), which the worktree guard refuses too.
export function writeRecord(home: string, job: Job, prompt: string, resumeOnBudget: boolean, idleMinutes: number, since: Date, projects: string): void {
	const folder = join(home, "jobs");
	const temporary = join(folder, `.${job.id}`);
	mkdirSync(temporary, { recursive: true });
	const record = {
		task: job.task, kind: job.kind, project: job.project, model: job.model ?? "", "model-why": job.modelWhy ?? "", thinking: job.thinking ?? "", quick: job.quick ?? "", prompt,
		timeout: String(job.timeoutMinutes), budget: String(job.budgetUsd), free: String(job.free), "resume-on-budget": String(resumeOnBudget), cpu: String(job.cpu ?? ""), memory: job.memory ?? "", cost: "0.0000",
		feature: job.feature?.name ?? "", "feature-cpu": String(job.feature?.cpu ?? ""), "feature-memory": job.feature?.memory ?? "",
		"idle-minutes": String(idleMinutes), branch: job.branch ?? "", root: job.root, base: job.base, worktree: job.worktree, machine: job.machine, projects,
		reason: "", since: since.toISOString(), state: "working",
	};
	for (const [name, value] of Object.entries(record)) writeFileSync(join(temporary, name), value);
	renameSync(temporary, join(folder, job.id));
}

// The job as its record `field` reads it, for `arthur continue` (job-control.ts): the `beforeSpawn` checks and the prepares.
export function recordedJob(id: string, field: (name: string) => string): Job {
	const or = (name: string) => field(name) || undefined;
	const [cpu, featureCpu] = [field("cpu"), field("feature-cpu")];
	const [task, feature] = [field("task"), or("feature")];
	return {
		id, task, kind: field("kind"), project: field("project"), model: or("model"), modelWhy: or("model-why"), thinking: or("thinking"), quick: or("quick"),
		timeoutMinutes: Number(field("timeout")), budgetUsd: Number(field("budget")), free: field("free") === "true", tickets: taskTickets(task), machine: field("machine") || "local", ignoreRestart: false,
		cpu: cpu === "" ? undefined : Number(cpu), memory: or("memory"), feature: feature === undefined ? undefined : { name: feature, cpu: featureCpu === "" ? undefined : Number(featureCpu), memory: or("feature-memory") },
		root: field("root"), base: field("base"), branch: or("branch"), worktree: field("worktree"),
	};
}

// A free id, `<date>-<kind>-<8 hex digits>`: no record, worktree or branch of that name exists yet. The worktree goes beside
// `place`, the repository it is added to: `root`, or the project's repository on another machine.
export function newJob(home: string, date: string, spawn: Spawn & Caps, root: string, base: string, readOnly: boolean, place: string): Job {
	for (;;) {
		const random = Buffer.from(crypto.getRandomValues(new Uint8Array(4))).toString("hex");
		const id = `${date}-${spawn.kind}-${random}`;
		const branch = readOnly ? undefined : `arthur/${id}`;
		const worktree = join(dirname(place), ".arthur-worktrees", id);
		if (existsSync(join(home, "jobs", id)) || existsSync(worktree) || (branch !== undefined && branchExists(root, branch))) continue;
		return { ...spawn, id, root, base, branch, worktree };
	}
}

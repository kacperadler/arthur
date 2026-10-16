import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Job } from "./jobs.ts";

// The job record `<home>/jobs/<id>/` (spec/roadmap.md, entries 9 and 10) as the spawn writes it, one file per key; the
// wrapper (entry 11) adds the files of the run.

// Written into `.<id>` and renamed, so a reader sees all of it or nothing. An empty `branch`, `model` or `thinking` is none;
// `prompt` is the role's, which the agent gets.
export function writeRecord(home: string, job: Job, prompt: string): void {
	const folder = join(home, "jobs");
	const temporary = join(folder, `.${job.id}`);
	mkdirSync(temporary, { recursive: true });
	const record = {
		task: job.task,
		kind: job.kind,
		model: job.model ?? "",
		thinking: job.thinking ?? "",
		timeout: String(job.timeoutMinutes),
		budget: String(job.budgetUsd),
		branch: job.branch ?? "",
		root: job.root,
		base: job.base,
		worktree: job.worktree,
		project: job.project,
		prompt,
	};
	for (const [name, value] of Object.entries(record)) writeFileSync(join(temporary, name), value);
	renameSync(temporary, join(folder, job.id));
}

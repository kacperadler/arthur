import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { reviewTask, worker } from "./review-command.ts";
import { failsSincePass, LIMIT, type Review, type Verdict } from "./review-records.ts";

// The hand-back after a FAIL review (spec/roadmap.md, entry 55), in `arthur run` alone, so one process acts: the FAIL filed, its
// worker continued with the findings and a new budget, the next review spawned when the worker's run finished, each through
// the host, so every `beforeSpawn` (`maxAgents`) holds. A refusal (`refused by <plugin>: ...`) keeps the step for the next
// `job-ended`, when a slot may be free; any other error drops the hand-back and tells the coordinator. `stop-all` drops every
// hand-back, and a job a step started meanwhile is stopped. The second FAIL since the last PASS starts none: the limit's
// procedure goes to the coordinator. docs/commands/review.md, "Hand-back".

// `continue`: the worker is to be continued; `continued`: its run goes on; `review`: the next review is to start; `reviewing`: it runs.
type Step = "continue" | "continued" | "review" | "reviewing";
type Pending = { readonly worker: string; readonly review: string; readonly findings: string; readonly step: Step };
// `start`: `arthur run`'s, from which on it acts; `ended`: a run's `job-ended`, with delivery's record of a review and its
// verdict; `cancel`: `stop-all`; `wake`: the worker's wake line while its hand-back goes on.
export type HandBack = {
	start(): void;
	ended(id: string, review: Review | undefined, verdict: Verdict | undefined): void;
	cancel(): void;
	wake(id: unknown): string | undefined;
};

const ID = /^[\w-]+$/;

export function handBack(host: Host): HandBack {
	const folder = join(host.folder, "hand-backs");
	const path = (id: string) => join(folder, `${id}.json`);
	const read = (id: string): Pending | undefined => {
		try {
			return ID.test(id) ? (JSON.parse(readFileSync(path(id), "utf8")) as Pending) : undefined;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			throw new Error(`${path(id)}: not a hand-back record (${(error as Error).message}); remove it`);
		}
	};
	const save = (record: Pending) => {
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, `.${record.worker}.${process.pid}`), `${JSON.stringify(record)}\n`);
		renameSync(join(folder, `.${record.worker}.${process.pid}`), path(record.worker));
	};
	const drop = (id: string) => rmSync(path(id), { force: true });
	const tell = (record: Pending, why: string) => {
		drop(record.worker);
		host.events.emit("coordinator-message", {
			text: `Delivery's hand-back of arthur/${record.worker} after FAIL ${record.review} stopped: ${why}. Hand it back yourself: arthur continue ${record.worker} '<the findings of ${record.review}>', then arthur review ${record.worker} once it ends.`,
		});
	};
	// `generation` counts the `stop-all`s: a run's end queued before one acts on no hand-back.
	let [started, generation, queue] = [false, 0, Promise.resolve()];
	const later = (fn: () => void | Promise<void>) => {
		if (started) queue = queue.then(fn).catch((error: Error) => console.error(`delivery: hand-back: ${error.message}`));
	};

	// One step of one hand-back; `run` starts its job, which a `stop-all` while it started stops again.
	const step = async (record: Pending, run: () => Promise<string>, next: Step) => {
		let id: string;
		try {
			id = await run();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.startsWith("refused by ")) tell(record, message);
			return;
		}
		if (read(record.worker) === undefined) await host.jobs.block(id, "arthur stopall cancelled delivery's hand-back", true);
		else save({ ...record, step: next });
	};
	const advance = async () => {
		const names = existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(".json")) : [];
		for (const record of names.sort().flatMap((name) => read(name.slice(0, -".json".length)) ?? [])) {
			if (record.step === "continue") await step(record, () => resume(host, record), "continued");
			if (record.step !== "review") continue;
			await step(
				record,
				async () => {
					const job = worker(host, record.worker);
					const { task, commit } = reviewTask(host, job, undefined);
					return (await host.jobs.spawn({ task, kind: "review", project: job.project, fetch: commit })).id;
				},
				"reviewing",
			);
		}
	};

	return {
		start() {
			started = true;
			later(advance);
		},
		// A run ended: a review's verdict starts, goes on with or ends its worker's hand-back; a worker in one that finished
		// gets its next review; and every step waiting for a slot is tried again.
		ended(id: string, review: Review | undefined, verdict: Verdict | undefined) {
			const at = generation;
			later(() => {
				const name = review?.branch.slice("arthur/".length) ?? id;
				const record = read(name);
				if (review !== undefined && record?.review !== review.id && verdict === "FAIL") file(review);
				if (at !== generation) return;
				if (review !== undefined && record?.review !== review.id) {
					// Below the limit the worker is continued; a PASS, no verdict, or the second FAIL ends the hand-back.
					if (verdict === "FAIL" && failsSincePass(host, review.branch).length < LIMIT) save({ worker: name, review: review.id, findings: host.jobs.result(review.id).trim(), step: "continue" });
					else drop(name);
				}
				const job = host.jobs.list().find((each) => each.id === id);
				if (review === undefined && record?.step === "continued" && job?.state !== "blocked") {
					if (job?.reason === "finished") save({ ...record, step: "review" });
					else drop(name);
				}
				return advance();
			});
		},
		cancel() {
			generation++;
			rmSync(folder, { recursive: true, force: true });
		},
		// The worker's wake line while its hand-back goes on, so the coordinator starts no review of its own.
		wake(id: unknown): string | undefined {
			const record = typeof id === "string" ? read(id) : undefined;
			const job = host.jobs.list().find((each) => each.id === id);
			if (record === undefined || record.step === "continue" || (job?.reason !== "finished" && job?.state !== "blocked")) return undefined;
			return `${record.worker} is in delivery's hand-back after FAIL ${record.review}: delivery starts the next review of arthur/${record.worker} itself ${job?.state === "blocked" ? "once its run ends" : "when a slot is free"}; run no arthur review-needed or arthur review for it.`;
		},
	};

	function file(review: Review) {
		try {
			host.jobs.file(review.ticket, review.id);
		} catch (error) {
			host.events.emit("coordinator-message", { text: `Delivery could not file FAIL ${review.id}: ${(error as Error).message}; file it with arthur ticket file ${review.ticket} ${review.id}.` });
		}
	}
}

// The worker continued with the review's findings and a new budget, its budget again on top of what it spent; no limit stays none.
async function resume(host: Host, record: Pending): Promise<string> {
	const job = host.jobs.list().find((each) => each.id === record.worker);
	const [cost, budget] = [Number(job?.cost) || 0, Number(job?.budget) || 0];
	const instruction = `Review ${record.review} of your branch arthur/${record.worker} says FAIL. Fix every finding below, run the project's checks, commit, and end: Arthur reviews the branch again when you end.\n\n## The review's final message\n\n${record.findings}`;
	const failed = await host.jobs.continue(record.worker, instruction, budget > 0 ? Math.round((cost + budget) * 100) / 100 : undefined);
	if (failed !== undefined) throw new Error(`its continue did not start: ${failed}`);
	return record.worker;
}

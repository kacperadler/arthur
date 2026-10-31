import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { reviewTask, untested, worker } from "./review-command.ts";
import { failsSincePass, LIMIT, type Review, type Verdict } from "./review-records.ts";

// The hand-back after a FAIL review (spec/roadmap.md, entry 55), in `arthur run` alone, so one process acts: the FAIL filed, its
// worker continued with the findings and a new budget, the next review spawned when the worker's run finished, each through
// the host, so every `beforeSpawn` (`maxAgents`) holds. Another plugin's refusal keeps the step for the next `job-ended`,
// when a slot may be free; the core's or delivery's own, which no freed slot lifts, and any other error drop the hand-back
// and tell the coordinator. `stop-all` drops every hand-back, and a job a step started meanwhile is stopped. The fourth FAIL
// (LIMIT) since the last PASS starts none: the limit's procedure goes to the coordinator. docs/commands/review.md, "Hand-back".

// `continue`: the worker is to be continued; `continued`: its run goes on; `review`: the next review is to start; `reviewing`: it runs; `missed`: it was continued once to run its checks.
type Step = "continue" | "continued" | "review" | "reviewing";
type Pending = { readonly worker: string; readonly review: string; readonly findings: string; readonly step: Step; readonly missed?: true };
// `start`: `arthur run`'s, from which on it acts; `ended`: a run's `job-ended`, with delivery's record of a review and its
// verdict; `cancel`: `stop-all`; `wake`: the worker's wake line while its hand-back goes on.
export type HandBack = {
	start(): void;
	ended(id: string, review: Review | undefined, verdict: Verdict | undefined): void;
	cancel(): void;
	wake(id: unknown): string | undefined;
};

const ID = /^[\w-]+$/;
// Why a job a step started as `stop-all` came is stopped again: its hold, `user: <this>`.
export const CANCELLED = "arthur stopall cancelled delivery's hand-back";
export const endHandBack = (host: Host, id: string) => ID.test(id) && rmSync(join(host.folder, "hand-backs", `${id}.json`), { force: true }); // A ticket's prune ends its job's hand-back (AR0555).

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
	// Each step waits in `queue`, which `start` opens: `arthur run` replays the log's events from before it at its start, and
	// another process never opens it. `generation` counts the `stop-all`s: a run's end queued before one acts on no hand-back.
	let [open, generation] = [() => {}, 0];
	let queue = new Promise<void>((resolve) => (open = resolve));
	const later = (fn: () => void | Promise<void>) => {
		queue = queue.then(fn).catch((error: Error) => console.error(`delivery: hand-back: ${error.message}`));
	};

	// One step of one hand-back; `run` starts its job, which a `stop-all` while it started stops again.
	const step = async (record: Pending, run: () => Promise<string>, next: Step) => {
		let id: string;
		try {
			id = await run();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.startsWith("refused by ") || ["core", host.name].some((owner) => message.startsWith(`refused by ${owner}: `))) tell(record, message);
			return;
		}
		if (read(record.worker) === undefined) await host.jobs.block(id, CANCELLED, true);
		else save({ ...record, step: next });
	};
	const advance = async () => {
		const names = existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(".json")) : [];
		for (const record of names.sort().flatMap((name) => read(name.slice(0, -".json".length)) ?? [])) {
			if (record.step === "continue") await step(record, () => resume(host, record), "continued");
			if (record.step !== "review") continue;
			// A tip without its checks passed (AR0580), once a round: an error reading it is `reviewTask`'s, below, which throws it again.
			const gap = record.missed === true ? undefined : await Promise.try(() => untested(host, worker(host, record.worker))).catch(() => undefined);
			if (gap !== undefined) await step({ ...record, missed: true }, () => resume(host, record, `Arthur starts no review yet: ${gap}. Commit your work, then run the project's check, test and mutate scripts (npm run check, npm test, npm run mutate) on the committed tip, change nothing after them, name each mutant that survives in your final message, and end: Arthur reviews the branch when you end.`), "continued");
			else await step(record, async () => {
				const job = worker(host, record.worker);
				const { task, commit } = reviewTask(host, job, undefined);
				return (await host.jobs.spawn({ task, kind: "review", project: job.project, fetch: commit })).id;
			}, "reviewing");
		}
	};

	return {
		start() {
			open();
			later(advance);
		},
		// A run ended: a review's verdict starts, goes on with or ends its worker's hand-back; a worker in one that finished
		// gets its next review; and every step waiting for a slot is tried again.
		ended(id: string, review: Review | undefined, verdict: Verdict | undefined) {
			const at = generation;
			later(() => {
				const name = review?.branch.slice("arthur/".length) ?? id;
				if (review !== undefined && host.board.get(review.ticket)?.status === "dropped") return drop(name); // A dropped ticket's FAIL is neither filed nor handed back (AR0555).
				const record = read(name);
				if (review !== undefined && record?.review !== review.id && verdict === "FAIL") file(review);
				if (at !== generation) return;
				if (review !== undefined && record?.review !== review.id) {
					// Below the limit the worker is continued; a PASS, no verdict, or the FAIL at the limit ends the hand-back.
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

// The worker continued with the review's findings, or `instruction`, and a new budget, its budget again on top of what it spent; no limit stays none.
async function resume(host: Host, record: Pending, instruction = `Review ${record.review} of your branch arthur/${record.worker} says FAIL. Fix every finding below, run the project's checks, commit, and end: Arthur reviews the branch again when you end.\n\n## The review's final message\n\n${record.findings}`): Promise<string> {
	const job = host.jobs.list().find((each) => each.id === record.worker);
	const [cost, budget] = [Number(job?.cost) || 0, Number(job?.budget) || 0];
	const failed = await host.jobs.continue(record.worker, instruction, budget > 0 ? Math.round((cost + budget) * 100) / 100 : undefined);
	if (failed !== undefined) throw new Error(`its continue did not start: ${failed}`);
	return record.worker;
}

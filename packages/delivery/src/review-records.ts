import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";

// Delivery's record of each review job (spec/roadmap.md, entry 52), `<folder>/reviews/<id>.json`, written by the review's
// prepare: its ticket, the branch and commit it reviews, when it started, and its verdict once its run ended. The core's record
// of a read-only kind names no branch and goes with `arthur prune`; this one stays, so a pruned FAIL still counts.

export type Verdict = "PASS" | "FAIL" | "none";
export type Review = { readonly id: string; readonly ticket: string; readonly branch: string; readonly commit: string; readonly at: number; readonly verdict?: Verdict };

// The FAILs since the last PASS a branch may have; the next review then needs the owner's word (`--round`).
export const LIMIT = 2;
// A job id, the only name a record file takes, so an event's `id` never leads out of the folder.
const ID = /^[\w-]+$/;

const folder = (host: Host) => join(host.folder, "reviews");

export function saveReview(host: Host, review: Review): void {
	mkdirSync(folder(host), { recursive: true });
	const draft = join(folder(host), `.${review.id}.${process.pid}`);
	writeFileSync(draft, `${JSON.stringify(review)}\n`);
	renameSync(draft, join(folder(host), `${review.id}.json`));
}

// Undefined when `id` is no review this plugin prepared.
export function readReview(host: Host, id: unknown): Review | undefined {
	if (typeof id !== "string" || !ID.test(id)) return undefined;
	const path = join(folder(host), `${id}.json`);
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
	try {
		return JSON.parse(text) as Review;
	} catch (error) {
		throw new Error(`${path}: not a review record (${(error as Error).message}); restore it or remove it`);
	}
}

// The verdict is the last line of the final message, exactly `PASS` or `FAIL`; anything else, a `PASS` above other text
// included, is none.
export function verdictOf(result: string): Verdict {
	const last = result.trimEnd().split("\n").at(-1)?.trim();
	return last === "PASS" || last === "FAIL" ? last : "none";
}

// A review's verdict once its run ended, kept in its record the first time it is read: none for a run that did not finish;
// undefined while it runs, or when the core's record went before a verdict was kept.
export function settle(host: Host, review: Review): Verdict | undefined {
	if (review.verdict !== undefined) return review.verdict;
	const job = host.jobs.list().find((each) => each.id === review.id);
	if (job === undefined || host.jobs.running().includes(review.id)) return undefined;
	const verdict = job.state === "ended" && job.reason === "finished" ? verdictOf(host.jobs.result(review.id)) : "none";
	saveReview(host, { ...review, verdict });
	return verdict;
}

// The reviews of `branch` delivery prepared, oldest first, each with its verdict as `settle` gives it.
export function reviewsOf(host: Host, branch: string): (readonly [Review, Verdict | undefined])[] {
	const names = existsSync(folder(host)) ? readdirSync(folder(host)) : [];
	const reviews = names.flatMap((name) => (name.endsWith(".json") ? (readReview(host, name.slice(0, -".json".length)) ?? []) : []));
	return reviews
		.filter((review) => review.branch === branch)
		.sort((a, b) => a.at - b.at)
		.map((review) => [review, settle(host, review)] as const);
}

// The FAIL reviews of `branch` since its last PASS, oldest first; a review that runs, or has no verdict, is no round.
export function failsSincePass(host: Host, branch: string): string[] {
	const verdicts = reviewsOf(host, branch);
	const pass = verdicts.findLastIndex(([, verdict]) => verdict === "PASS");
	return verdicts.slice(pass + 1).flatMap(([review, verdict]) => (verdict === "FAIL" ? [review.id] : []));
}

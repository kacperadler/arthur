import { readFileSync } from "node:fs";
import type { Host } from "@arthur/core/plugin";
import { entryOf } from "./auto-merge.ts";
import { CANCELLED } from "./hand-back.ts";
import { failsSincePass, LIMIT, type Review, settle, type Verdict, verdictOf } from "./review-records.ts";

// What a review's wake reads: its record, its verdict, its project and whether that merges on its own, why its run ended,
// and its place among the FAILs of its branch since the last PASS.
type Seen = { readonly review: Omit<Review, "at">; readonly verdict: Verdict | undefined; readonly project: string; readonly autoMerge: boolean; readonly reason: string | undefined; readonly fails: () => number };

export function recorded(host: Host, review: Review): Seen {
	const [verdict, job] = [settle(host, review), host.jobs.list().find((each) => each.id === review.id)];
	const project = job?.project ?? "";
	// Its own place among the FAILs since the last PASS, so a wake built later says what it said at the end.
	return { review, verdict, project, autoMerge: entryOf(host, project)?.pieces?.delivery?.autoMerge === true, reason: job?.reason, fails: () => failsSincePass(host, review.branch).indexOf(review.id) + 1 };
}

// A review in no home (an eval's, docs/commands/review.md): the record its data names, `records.delivery`, `{ ticket, branch,
// commit, autoMerge? }`, its verdict read from `result` as `settle` reads it, and no FAIL of its branch before it.
export function named(job: Readonly<Record<string, unknown>>, result: unknown): Seen | undefined {
	const given = (job.records as { readonly delivery?: unknown } | undefined)?.delivery;
	if (given === undefined) return undefined;
	const { ticket, branch, commit, autoMerge } = (typeof given === "object" && given !== null ? given : {}) as Readonly<Record<string, unknown>>;
	if (typeof ticket !== "string" || !/^[A-Z]+\d{4,}$/.test(ticket) || typeof branch !== "string" || !/^arthur\/\S+$/.test(branch) || typeof commit !== "string" || !/^[0-9a-f]{7,40}$/.test(commit) || (autoMerge !== undefined && typeof autoMerge !== "boolean"))
		throw new Error(`review ${String(job.id)}: records.delivery: expected { ticket: <id>, branch: arthur/<worker job>, commit: <sha>, autoMerge?: true | false }, got ${JSON.stringify(given)}`);
	const verdict = job.state === "ended" && job.reason === "finished" ? verdictOf(typeof result === "string" ? result : "") : "none";
	return { review: { id: String(job.id), ticket, branch, commit }, verdict, project: String(job.project ?? ""), autoMerge: autoMerge === true, reason: typeof job.reason === "string" ? job.reason : undefined, fails: () => 1 };
}

// What the coordinator's wake adds for an ended review: its verdict and the ticket's move, how to file it, or for a FAIL that
// delivery files it and below the limit hands the branch back (hand-back.ts), and at the limit the procedure.
export function wake({ review, verdict, project, autoMerge, reason, fails: place }: Seen, procedure: URL): string {
	const worker = review.branch.slice("arthur/".length);
	const file = `File it: arthur ticket file ${review.ticket} ${review.id}, commit it, then arthur prune ${review.id}.`;
	if (verdict === "PASS") {
		const next = autoMerge ? `${project} merges on its own (autoMerge): delivery runs arthur merge --auto ${worker}, whose merge files and prunes this review, and wakes you with what it printed; nothing to do until then.` : file;
		return `Review verdict: PASS on ${review.branch} at ${review.commit.slice(0, 7)}; ${review.ticket} moves to done. ${next}`;
	}
	// Stopped by `arthur stop` or `stopall`, or by the hand-back as `stop-all` came: started again only on the owner's word.
	if (verdict !== "FAIL" && (reason === "stopped" || reason === `user: ${CANCELLED}`))
		return `Review ${review.id} was stopped, so it has no verdict, is never filed, and ${review.ticket} stays at review. Review again only when the owner asks: arthur review ${worker}; arthur prune ${review.id} frees it.`;
	if (verdict !== "FAIL")
		return `Review ${review.id}: no verdict, so the review failed: the last line of its final message is not PASS or FAIL alone though Arthur resumed it once for that already, or its run did not finish. It is never filed, and ${review.ticket} stays at review. Review again with arthur review ${worker}, then arthur prune ${review.id}.`;
	const fails = place();
	const values: Readonly<Record<string, string>> = { branch: review.branch, commit: review.commit.slice(0, 7), fails: String(fails), ticket: review.ticket, review: review.id, worker };
	// The wording beside the limit's procedure (roles/coordinator/), below the limit and at it, the live parts filled in.
	const wording = new URL(`review-failed${fails < LIMIT ? "" : "-limit"}.md`, procedure);
	const line = readFileSync(wording, "utf8").trim().replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);
	return fails < LIMIT ? line : `${line}\n\n${readFileSync(procedure, "utf8").trim()}`;
}

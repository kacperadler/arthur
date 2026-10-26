import { readFileSync } from "node:fs";
import { matchesGlob } from "node:path";
import type { Host, Plugin } from "@arthur/core/plugin";
import { entryOf } from "./auto-merge.ts";
import { changelogCommand } from "./changelog.ts";
import { type CiEnd, type CiWaits, ciEnded, ciWaits } from "./ci-wait.ts";
import { ALWAYS_REVIEW, checkOptions } from "./delivery-options.ts";
import { CANCELLED, type HandBack, handBack } from "./hand-back.ts";
import { identityRequirement, mergeCommand } from "./merge-command.ts";
import { reviewCommand, reviewTask, worker } from "./review-command.ts";
import { reviewFiler } from "./review-file.ts";
import { reviewNeededCommand } from "./review-needed.ts";
import { failsSincePass, LIMIT, type Review, readReview, saveReview, settle, type Verdict, verdictOf } from "./review-records.ts";
import { takeMainCommand } from "./take-main.ts";

// The delivery plugin (spec/roadmap.md, entry 52): the kind `review`, a read-only job on the reviewer role in a detached checkout
// of a worker's branch, on `roles.reviewer`'s model in a session of its own. It moves its ticket to review as it starts, and its
// verdict, `PASS` or `FAIL` alone on the last line, moves it to done or back to in-progress; with neither its run ends failed (the
// kind's `verdicts`) and is never filed. A branch gets at most 2 FAILs since its last PASS; the next review needs `Round: <n>` (`arthur review --round`)
// on the owner's word, and the wake of the second FAIL carries the procedure. docs/commands/review.md. Entry 53: `arthur
// review-needed`, the always-review list it and autopilot ask (`delivery.alwaysReview`), and the extension that records each
// job's checks: docs/commands/review-needed.md. Entry 54: `arthur merge`: docs/commands/merge.md. Entry 55: the hand-back after
// a FAIL (hand-back.ts): docs/commands/review.md, "Hand-back". Entry 56: `arthur changelog`: docs/commands/changelog.md. Entry
// 59: `arthur merge --auto`, and the CI waits it leaves, polled while `arthur run` runs (ci-wait.ts).

const REVIEW = "review";
const TICKET = /^spec\/features\/([A-Z]+\d{4,})-[^/]+\/ticket\.md$/;
// The statuses a reviewed ticket may have: its worker started it, and a review moves it to review.
const REVIEWED = ["in-progress", "review", "done"];

export function delivery(options: { readonly enabled?: boolean; readonly review?: { readonly alwaysReview?: readonly string[] } } = {}): Plugin {
	let loop: HandBack | undefined;
	let waits: CiWaits | undefined;
	return {
		name: "delivery",
		module: import.meta.url,
		options,
		check: checkOptions,
		start() {
			loop?.start();
			waits?.start();
		},
		stop: () => waits?.stop(),
		setup(host) {
			const back = handBack(host);
			loop = back;
			waits = ciWaits(host);
			const procedure = new URL("../roles/coordinator/review-limit.md", import.meta.url);
			const always = options.review?.alwaysReview ?? ALWAYS_REVIEW;
			const held = (path: string) => always.some((glob) => matchesGlob(path, glob));
			host.jobs.registerRole({ name: "reviewer", file: new URL("../roles/reviewer.md", import.meta.url), criteria: ["styleguide", "review"] });
			host.jobs.registerKind({ name: REVIEW, readOnly: true, role: "reviewer", verdicts: ["PASS", "FAIL"], file: reviewFiler(host) });
			host.jobs.beforeSpawn(({ kind, task, tickets, project }) => (kind === REVIEW ? refusal(host, task, tickets, project) : undefined));
			host.jobs.prepare(async (job, _env, continued) => {
				if (job.kind !== REVIEW || continued) return;
				const { branch = "", commit = "" } = head(job.task);
				// No hook or fsmonitor the repository's shared config names runs, nor a replacement (refs/replace): a program a job runs may have set them (AR0330, AR0384).
				const ran = await host.jobs.run(job.machine, ["git", "--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", job.worktree, "checkout", "--quiet", "--detach", commit]);
				if (ran.code !== 0) throw new Error(`${branch} at ${commit} cannot be checked out on machine ${job.machine}: ${ran.stderr.trim().split("\n").at(-1) ?? ""}`);
				saveReview(host, { id: job.id, ticket: TICKET.exec(job.tickets[0] ?? "")?.[1] ?? "", branch, commit, at: Date.now() });
			});
			host.events.on("job-started", ({ data }) => {
				const review = readReview(host, typeof data === "object" && data !== null && "id" in data ? data.id : undefined);
				if (review !== undefined) host.board.move(review.ticket, "review");
			});
			host.events.on("job-ended", ({ data }) => {
				const id = typeof data === "object" && data !== null && "id" in data ? data.id : undefined;
				const review = readReview(host, id);
				const verdict = review && settle(host, review);
				// Every run's end goes to the hand-back (queued, so it acts after the moves below); a PASS's branch is pushed.
				if (typeof id === "string") back.ended(id, review, verdict);
				if (review === undefined || (verdict !== "PASS" && verdict !== "FAIL")) return;
				host.board.move(review.ticket, verdict === "PASS" ? "done" : "in-progress");
				if (verdict === "FAIL") return;
				// The plugin that provides `github.push` (entry 58), when one is loaded, pushes the reviewed branch: its line goes to the log.
				const branch = { project: host.jobs.list().find((job) => job.id === review.id)?.project ?? "", branch: review.branch };
				void Promise.all(host.collect<Promise<string>>("github.push", branch)).then((lines) => lines.forEach((line) => console.log(line)));
			});
			host.events.on("stop-all", () => back.cancel());
			// Asked with the job-ended data and the final message the wake shows: a review of this home by its record, one in
			// no home (an eval's) by the record its data names.
			host.provide("coordinator.wake", (job: Readonly<Record<string, unknown>>, result?: unknown) => {
				const review = job.kind === REVIEW ? readReview(host, job.id) : undefined;
				const seen = review ? recorded(host, review) : job.kind === REVIEW ? named(job, result) : undefined;
				return seen ? wake(seen, procedure) : back.wake(job.id);
			});
			host.commands.register(reviewCommand(host, procedure));
			host.commands.register(reviewNeededCommand(host, held));
			host.commands.register(mergeCommand(host, new URL("../roles/coordinator/after-merge.md", import.meta.url), held));
			host.commands.register(takeMainCommand(host));
			host.commands.register(changelogCommand(host));
			host.jobs.registerExtension(new URL("./checks-extension.ts", import.meta.url));
			// Asked with a project and paths from its root (orchestration's autopilot): those on the list, the same in every project.
			host.provide("delivery.alwaysReview", ({ paths }: { readonly paths: readonly string[] }) => paths.filter(held));
			// Asked by github's poll as a run ends on a branch: true when a CI wait woke the coordinator for it (ci-wait.ts).
			host.provide("delivery.ciEnded", (end: CiEnd) => ciEnded(host, end));
			// `arthur doctor` and the start of `arthur run`: git's identity for a merge commit in each project's checkout, told before
			// a review is paid for, not by `arthur merge` after it.
			host.provide("doctor", () => host.board.projects().map(({ name, path }) => identityRequirement(name, path)));
		},
	};
}

// The lines `arthur review` writes in a review's task before its first blank line: `Branch:`, `Commit:` and `Round:`.
function head(task: string): { readonly branch?: string; readonly commit?: string; readonly round?: number } {
	const lines = task.split(/\n\s*\n/)[0] ?? "";
	const round = /^Round: ([1-9]\d*)$/m.exec(lines)?.[1];
	return { branch: /^Branch: (arthur\/\S+)$/m.exec(lines)?.[1], commit: /^Commit: ([0-9a-f]{7,40})$/m.exec(lines)?.[1], round: round === undefined ? undefined : Number(round) };
}

// Why a review may not start, if it may not: its one ticket, on the board and started; its branch and commit; its round; and its task, only what `reviewTask` builds now for the ended worker its branch names, at its tip (AR0357), in that worker's project (AR0431).
function refusal(host: Host, task: string, tickets: readonly string[], project: string): string | undefined {
	const [path = ""] = tickets;
	const id = TICKET.exec(path)?.[1];
	if (tickets.length !== 1 || id === undefined) return `a review names its one ticket on a line Ticket: spec/features/<id>-<slug>/ticket.md; its task names ${tickets.length === 0 ? "none" : tickets.join(", ")}`;
	const status = host.board.get(id)?.status;
	if (status === undefined) return `${id} is not on the board`;
	if (!REVIEWED.includes(status)) return `${id} is ${status}; a review is of a ticket in-progress, review or done`;
	const { branch, commit, round } = head(task);
	if (branch === undefined || commit === undefined)
		return "a review names the branch and commit it reviews on lines Branch: arthur/<worker job> and Commit: <sha>, below its Ticket: line; arthur review <worker job> writes them";
	const fails = failsSincePass(host, branch);
	const next = fails.length + 1;
	if (round !== undefined && round !== next) return `round ${round} is not the next one of ${branch}: it has ${fails.length} FAIL${fails.length === 1 ? "" : "s"} since its last PASS, so the next round is ${next}`;
	if (round === undefined && fails.length >= LIMIT)
		return `${fails.length} FAILs on ${branch} since its last PASS: ${fails.join(", ")}; the owner decides what comes next, and only on his word: arthur review ${branch.slice("arthur/".length)} --round ${next}`;
	try {
		const job = worker(host, branch.slice("arthur/".length));
		if (job.project === project && reviewTask(host, job, round).task === task) return undefined;
	} catch {}
	return "a review's task is what arthur review writes; spawn it with arthur review <worker job>";
}

// What a review's wake reads: its record, its verdict, its project and whether that merges on its own, why its run ended,
// and its place among the FAILs of its branch since the last PASS.
type Seen = { readonly review: Omit<Review, "at">; readonly verdict: Verdict | undefined; readonly project: string; readonly autoMerge: boolean; readonly reason: string | undefined; readonly fails: () => number };

function recorded(host: Host, review: Review): Seen {
	const [verdict, job] = [settle(host, review), host.jobs.list().find((each) => each.id === review.id)];
	const project = job?.project ?? "";
	// Its own place among the FAILs since the last PASS, so a wake built later says what it said at the end.
	return { review, verdict, project, autoMerge: entryOf(host, project)?.autoMerge === true, reason: job?.reason, fails: () => failsSincePass(host, review.branch).indexOf(review.id) + 1 };
}

// A review in no home (an eval's, docs/commands/review.md): the record its data names, `records.delivery`, `{ ticket, branch,
// commit, autoMerge? }`, its verdict read from `result` as `settle` reads it, and no FAIL of its branch before it.
function named(job: Readonly<Record<string, unknown>>, result: unknown): Seen | undefined {
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
function wake({ review, verdict, project, autoMerge, reason, fails: place }: Seen, procedure: URL): string {
	const worker = review.branch.slice("arthur/".length);
	const file = `File it: arthur ticket file ${review.ticket} ${review.id}, commit it, then arthur prune ${review.id}.`;
	if (verdict === "PASS") {
		const auto = autoMerge ? ` ${project} merges on its own (autoMerge): after that commit, arthur merge --auto ${worker}.` : "";
		return `Review verdict: PASS on ${review.branch} at ${review.commit.slice(0, 7)}; ${review.ticket} moves to done. ${file}${auto}`;
	}
	// Stopped by `arthur stop` or `stopall`, or by the hand-back as `stop-all` came: started again only on the owner's word.
	if (verdict !== "FAIL" && (reason === "stopped" || reason === `user: ${CANCELLED}`))
		return `Review ${review.id} was stopped, so it has no verdict, is never filed, and ${review.ticket} stays at review. Review again only when the owner asks: arthur review ${worker}; arthur prune ${review.id} frees it.`;
	if (verdict !== "FAIL")
		return `Review ${review.id}: no verdict, so the review failed: the last line of its final message is not PASS or FAIL alone, or its run did not finish. It is never filed, and ${review.ticket} stays at review. Review again with arthur review ${worker}, then arthur prune ${review.id}.`;
	const fails = place();
	const filed = `Delivery files it as the next review-N.md in ${review.ticket}'s folder; commit that, then arthur prune ${review.id}.`;
	const back = fails < LIMIT ? ` It hands the branch back: ${worker} continues with the findings and a new budget, and the next review starts when it ends; arthur stopall cancels it.` : " The hand-back stops at the limit.";
	const line = `Review verdict: FAIL on ${review.branch} at ${review.commit.slice(0, 7)}, ${fails} since its last PASS; ${review.ticket} moves back to in-progress. ${filed}${back}`;
	return fails >= LIMIT ? `${line}\n\n${readFileSync(procedure, "utf8").trim()}` : line;
}

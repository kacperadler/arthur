import { readFileSync } from "node:fs";
import { matchesGlob } from "node:path";
import type { Host, Plugin } from "@arthur/core/plugin";
import { ALWAYS_REVIEW, checkOptions } from "./delivery-options.ts";
import { mergeCommand } from "./merge-command.ts";
import { reviewCommand } from "./review-command.ts";
import { reviewFiler } from "./review-file.ts";
import { reviewNeededCommand } from "./review-needed.ts";
import { failsSincePass, LIMIT, type Review, readReview, saveReview, settle } from "./review-records.ts";

// The delivery plugin (spec/roadmap.md, entry 52): the kind `review`, a read-only job on the reviewer role in a detached checkout
// of a worker's branch, on `roles.reviewer`'s model in a session of its own. It moves its ticket to review as it starts, and its
// verdict, `PASS` or `FAIL` alone on the last line, moves it to done or back to in-progress; with neither its run ends failed (the
// kind's `verdicts`) and is never filed. A branch gets at most 2 FAILs since its last PASS; the next review needs `Round: <n>` (`arthur review --round`)
// on the owner's word, and the wake of the second FAIL carries the procedure. docs/commands/review.md. Entry 53: `arthur
// review-needed`, the always-review list it and autopilot ask (`delivery.alwaysReview`), and the extension that records each
// job's checks: docs/commands/review-needed.md. Entry 54: `arthur merge`: docs/commands/merge.md.

const REVIEW = "review";
const TICKET = /^spec\/features\/([A-Z]+\d{4,})-[^/]+\/ticket\.md$/;
// The statuses a reviewed ticket may have: its worker started it, and a review moves it to review.
const REVIEWED = ["in-progress", "review", "done"];

export function delivery(options: { readonly enabled?: boolean; readonly review?: { readonly alwaysReview?: readonly string[] } } = {}): Plugin {
	return {
		name: "delivery",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			const procedure = new URL("../roles/coordinator/review-limit.md", import.meta.url);
			const always = options.review?.alwaysReview ?? ALWAYS_REVIEW;
			const held = (path: string) => always.some((glob) => matchesGlob(path, glob));
			host.jobs.registerRole({ name: "reviewer", file: new URL("../roles/reviewer.md", import.meta.url), criteria: ["styleguide", "review"] });
			host.jobs.registerKind({ name: REVIEW, readOnly: true, role: "reviewer", verdicts: ["PASS", "FAIL"], file: reviewFiler(host) });
			host.jobs.beforeSpawn(({ kind, task, tickets }) => (kind === REVIEW ? refusal(host, task, tickets) : undefined));
			host.jobs.prepare(async (job, _env, continued) => {
				if (job.kind !== REVIEW || continued) return;
				const { branch = "", commit = "" } = head(job.task);
				const ran = await host.jobs.run(job.machine, ["git", "-C", job.worktree, "checkout", "--quiet", "--detach", commit]);
				if (ran.code !== 0) throw new Error(`${branch} at ${commit} cannot be checked out on machine ${job.machine}: ${ran.stderr.trim().split("\n").at(-1) ?? ""}`);
				saveReview(host, { id: job.id, ticket: TICKET.exec(job.tickets[0] ?? "")?.[1] ?? "", branch, commit, at: Date.now() });
			});
			host.events.on("job-started", ({ data }) => {
				const review = readReview(host, typeof data === "object" && data !== null && "id" in data ? data.id : undefined);
				if (review !== undefined) host.board.move(review.ticket, "review");
			});
			host.events.on("job-ended", ({ data }) => {
				const review = readReview(host, typeof data === "object" && data !== null && "id" in data ? data.id : undefined);
				const verdict = review && settle(host, review);
				if (review === undefined || (verdict !== "PASS" && verdict !== "FAIL")) return;
				host.board.move(review.ticket, verdict === "PASS" ? "done" : "in-progress");
				if (verdict === "FAIL") return;
				// The plugin that provides `github.push` (entry 58), when one is loaded, pushes the reviewed branch: its line goes to the log.
				const branch = { project: host.jobs.list().find((job) => job.id === review.id)?.project ?? "", branch: review.branch };
				void Promise.all(host.collect<Promise<string>>("github.push", branch)).then((lines) => lines.forEach((line) => console.log(line)));
			});
			host.provide("coordinator.wake", (job: { readonly id?: unknown; readonly kind?: unknown }) => {
				const review = job.kind === REVIEW ? readReview(host, job.id) : undefined;
				return review && wake(host, review, procedure);
			});
			host.commands.register(reviewCommand(host, procedure));
			host.commands.register(reviewNeededCommand(host, held));
			host.commands.register(mergeCommand(host, new URL("../roles/coordinator/after-merge.md", import.meta.url)));
			host.jobs.registerExtension(new URL("./checks-extension.ts", import.meta.url));
			// Asked with a project and paths from its root (orchestration's autopilot): those on the list, the same in every project.
			host.provide("delivery.alwaysReview", ({ paths }: { readonly paths: readonly string[] }) => paths.filter(held));
		},
	};
}

// The lines `arthur review` writes in a review's task before its first blank line: `Branch:`, `Commit:` and `Round:`.
function head(task: string): { readonly branch?: string; readonly commit?: string; readonly round?: number } {
	const lines = task.split(/\n\s*\n/)[0] ?? "";
	const round = /^Round: ([1-9]\d*)$/m.exec(lines)?.[1];
	return { branch: /^Branch: (arthur\/\S+)$/m.exec(lines)?.[1], commit: /^Commit: ([0-9a-f]{7,40})$/m.exec(lines)?.[1], round: round === undefined ? undefined : Number(round) };
}

// Why a review may not start, if it may not: its one ticket, on the board and started; its branch and commit; and its round.
function refusal(host: Host, task: string, tickets: readonly string[]): string | undefined {
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
	return undefined;
}

// What the coordinator's wake adds for an ended review: its verdict and the ticket's move, how to file it, and at the limit the
// procedure.
function wake(host: Host, review: Review, procedure: URL): string {
	const verdict = settle(host, review);
	const worker = review.branch.slice("arthur/".length);
	const file = `File it: arthur ticket file ${review.ticket} ${review.id}, commit it, then arthur prune ${review.id}.`;
	if (verdict === "PASS") return `Review verdict: PASS on ${review.branch} at ${review.commit.slice(0, 7)}; ${review.ticket} moves to done. ${file}`;
	if (verdict !== "FAIL")
		return `Review ${review.id}: no verdict, so the review failed: the last line of its final message is not PASS or FAIL alone, or its run did not finish. It is never filed, and ${review.ticket} stays at review. Review again with arthur review ${worker}, then arthur prune ${review.id}.`;
	// Its own place among the FAILs since the last PASS, so a wake built later says what it said at the end.
	const fails = failsSincePass(host, review.branch).indexOf(review.id) + 1;
	const line = `Review verdict: FAIL on ${review.branch} at ${review.commit.slice(0, 7)}, ${fails} since its last PASS; ${review.ticket} moves back to in-progress. ${file}`;
	return fails >= LIMIT ? `${line}\n\n${readFileSync(procedure, "utf8").trim()}` : line;
}

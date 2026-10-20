import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host, JobRecord, Ticket } from "@arthur/core/plugin";
import type { Step } from "./merge-checks.ts";
import { reviewsOf } from "./review-records.ts";

// What `arthur merge` does for the ticket once its branch is in and the checks passed (spec/roadmap.md, entry 54): files the
// branch's reviews, hands the ticket's findings to `findings.onMerge`, writes `outcome.md`, sets the ticket merged and names
// the planned tickets it unblocks. docs/commands/merge.md, "Steps".

export type Merged = {
	readonly job: JobRecord;
	readonly ticket: Ticket;
	readonly folder: string;
	readonly root: string;
	readonly hash: string;
	readonly subjects: readonly string[];
	readonly steps: readonly Step[];
	readonly gap: string;
};

const REVIEW = /^review-(\d+)\.md$/;

export function settleTicket(host: Host, merged: Merged, log: (line: string) => void): void {
	const { job, ticket, folder, root } = merged;
	const filed = () =>
		readdirSync(join(root, folder))
			.flatMap((name) => (REVIEW.test(name) ? [{ name, text: readFileSync(join(root, folder, name), "utf8") }] : []))
			.sort((a, b) => Number(REVIEW.exec(a.name)?.[1]) - Number(REVIEW.exec(b.name)?.[1]));
	const known = filed().map(({ text }) => /^- Job: (.+)$/m.exec(text)?.[1]);
	const ended = reviewsOf(host, job.branch).filter(([, verdict]) => verdict === "PASS" || verdict === "FAIL");
	for (const [review] of ended.filter(([review]) => !known.includes(review.id))) {
		try {
			log(`filed ${host.jobs.file(ticket.id, review.id)}`);
		} catch (error) {
			log(`review ${review.id}: not filed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	const reviews = filed()
		.filter(({ text }) => text.includes(`\n- Branch: ${job.branch}\n`))
		.map(({ name, text }) => `${name} ${/^- Verdict: (.+)$/m.exec(text)?.[1] ?? "none"}`);
	const records = host.jobs.list();
	const dollars = (ids: readonly string[]) => {
		const costs = ids.map((id) => records.find((record) => record.id === id)?.cost ?? "");
		return costs.some((cost) => cost === "") ? "n/a" : `$${costs.reduce((sum, cost) => sum + Number(cost), 0).toFixed(2)}`;
	};
	const left = findings(host, merged);
	for (const line of left) log(line);
	const text = [
		`# ${ticket.id} - Outcome`,
		"",
		`- Merged: ${host.clock.local().date}, \`${merged.hash}\``,
		`- Branch: ${job.branch}`,
		`- Reviews: ${reviews.join(", ") || "none"}${merged.gap && `; merged unreviewed (--unreviewed): ${merged.gap}`}`,
		`- Cost: worker ${dollars([job.id])}, reviews ${dollars(ended.map(([review]) => review.id))}; review rounds ${reviews.length}`,
		...["", "## What went in", "", ...merged.subjects.map((subject) => `- ${subject}`)],
		...["", "## Checks on main", "", ...(merged.steps.length > 0 ? merged.steps.map((each) => `- \`${each.command}\`: ${each.result}`) : ["- no checks"])],
		...["", "## Left open", "", ...left, ""],
	].join("\n");
	const draft = join(root, folder, `.outcome.${process.pid}`);
	writeFileSync(draft, text);
	renameSync(draft, join(root, folder, "outcome.md"));
	log(`wrote ${folder}/outcome.md; rewrite What went in from the commit subjects listed there`);
	host.board.move(ticket.id, "merged");
	log(`${ticket.id} merged`);
	const board = host.board.list(job.project);
	const unblocked = board.filter((each) => each.status === "planned" && each.after?.includes(ticket.id) === true && each.after.every((id) => board.find((other) => other.id === id)?.status === "merged"));
	if (unblocked.length > 0) log(`unblocked: ${unblocked.map((each) => each.id).join(", ")}`);
}

// The `## Left open` lines: each `findings.onMerge` provider's answer, asked with the ticket's `findings.md`; without one, the
// findings stay as they are, said once.
function findings(host: Host, { job, ticket, folder, root }: Merged): string[] {
	const path = `${folder}/findings.md`;
	const answers = host.collectEach("findings.onMerge", { project: job.project, ticket: ticket.id, path, root });
	if (answers.length === 0)
		return [existsSync(join(root, path)) ? `- Findings: ${path} left as it is, every open entry still open: no plugin provides findings.onMerge` : "- Findings: none; no findings.md on this ticket."];
	return answers.flatMap((answer) => {
		if ("error" in answer) return [`- Findings: findings.onMerge of ${answer.plugin} failed: ${answer.error.message}; ${path} left as it is`];
		return typeof answer.value === "string" && answer.value.trim() !== "" ? answer.value.trim().split("\n") : [`- Findings: findings.onMerge of ${answer.plugin} answered no lines`];
	});
}

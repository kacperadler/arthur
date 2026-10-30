import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { configRefusal } from "@arthur/core/git-config";
import type { Host, JobRecord, Ticket } from "@arthur/core/plugin";
import { writeChangelog } from "./changelog.ts";
import type { Step } from "./merge-checks.ts";
import { reviewsOf } from "./review-records.ts";

// What `arthur merge` does for the ticket once its branch is in and the checks passed (spec/roadmap.md, entry 54): files the
// branch's reviews, hands the ticket's findings and its passed review's notes to `findings.onMerge`, writes `outcome.md`, sets the ticket merged, names
// the planned tickets it unblocks, rebuilds CHANGELOG.md and commits the ticket's side. docs/commands/merge.md, "Steps".

export type Merged = {
	readonly job: JobRecord;
	readonly ticket: Ticket;
	readonly folder: string;
	readonly root: string;
	readonly hash: string;
	readonly subjects: readonly string[];
	readonly steps: readonly Step[];
	readonly gap: string;
	readonly git: (...words: string[]) => { readonly status: number | null; readonly stdout: string; readonly stderr: string };
};

const REVIEW = /^review-(\d+)\.md$/;
const DESCRIBED = /^- `?(.+?)`?: \S/;

export function settleTicket(host: Host, merged: Merged, log: (line: string) => void): void {
	const { job, ticket, folder, root, git } = merged;
	const had = new Set(host.board.list(job.project).map((each) => each.id));
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
	// A cost as the core's record holds it now, else as delivery's review record kept it when the review ended (a pruned one).
	const records = host.jobs.list();
	const live = (id: string) => records.find((record) => record.id === id)?.cost;
	const dollars = (costs: readonly (string | undefined)[]) => (costs.some((cost) => cost === undefined || cost === "") ? "n/a" : `$${costs.reduce((sum, cost) => sum + Number(cost), 0).toFixed(2)}`);
	const left = findings(host, merged, notesOf(filed(), job.branch));
	for (const line of left) log(line);
	const text = [
		`# ${ticket.id} - Outcome`,
		"",
		`- Merged: ${host.clock.local().date}, \`${merged.hash}\``,
		`- Branch: ${job.branch}`,
		`- Reviews: ${reviews.join(", ") || "none"}${merged.gap && `; merged unreviewed (--unreviewed): ${merged.gap}`}`,
		`- Cost: worker ${dollars([live(job.id)])}, reviews ${dollars(ended.map(([review]) => live(review.id) ?? review.cost))}; review rounds ${reviews.length}`,
		...["", "## What went in", "", ...wentIn(host, merged)],
		...["", "## Checks on main", "", ...(merged.steps.length > 0 ? merged.steps.map((each) => `- \`${each.command}\`: ${each.result}`) : ["- no checks"])],
		...["", "## Left open", "", ...left, ""],
	].join("\n");
	const draft = join(root, folder, `.outcome.${process.pid}`);
	writeFileSync(draft, text);
	renameSync(draft, join(root, folder, "outcome.md"));
	log(`wrote ${folder}/outcome.md`);
	host.board.move(ticket.id, "merged");
	log(`${ticket.id} merged`);
	const board = host.board.list(job.project);
	const unblocked = board.filter((each) => each.status === "planned" && each.after?.includes(ticket.id) === true && each.after.every((id) => board.find((other) => other.id === id)?.status === "merged"));
	if (unblocked.length > 0) log(`unblocked: ${unblocked.map((each) => each.id).join(", ")}`);
	log(writeChangelog(host, job.project));
	// The ticket's side in one commit before the push, the tickets findings.onMerge made and the board's other moves with it; a job may have written the config while the checks ran.
	const made = host.board.list(job.project).flatMap((each) => (had.has(each.id) ? [] : [dirname(each.path)]));
	const paths = [folder, ...made, "spec/build.json", "CHANGELOG.md"].filter((path) => existsSync(join(root, path)));
	const subject = `spec: ${ticket.id} merged`;
	const refusal = configRefusal(root);
	const added = refusal === "" ? git("add", "--all", "--", ...paths) : { status: 1, stdout: "", stderr: refusal };
	const done = added.status === 0 ? git("commit", "--quiet", "-m", subject, "--", ...paths) : added;
	if (done.status === 0) log(`committed ${subject}: ${git("rev-parse", "--short", "HEAD").stdout.trim()}`);
	else log(`${subject} not committed: ${(done.stderr.trim() || done.stdout.trim()).split("\n").at(-1)}; commit ${paths.join(", ")}`);
}

// The `- <path>: <what it does now>` lines (the path in backticks or not) of the `## What went in` of the worker's final message,
// then `- <path>: not described` for each file the merge changed that none names; without that section, the branch's commit subjects.
function wentIn(host: Host, { job, hash, subjects, git }: Merged): string[] {
	const section = host.jobs.result(job.id).split(/^## What went in[ \t]*$/m)[1]?.split(/^#{1,2} /m)[0];
	if (section === undefined) return subjects.map((subject) => `- ${subject}`);
	const lines = section.split("\n").filter((line) => DESCRIBED.test(line));
	const named = new Set(lines.map((line) => DESCRIBED.exec(line)?.[1]));
	const files = git("diff", "--name-only", "--no-renames", "-z", `${hash}^1`, hash).stdout.split("\0").filter(Boolean);
	return [...lines, ...files.filter((file) => !named.has(file)).map((file) => `- ${file}: not described`)];
}

// The `## Left open` lines: each `findings.onMerge` provider's answer, asked with the ticket's `findings.md` and the passed
// review's notes; without one, the findings stay as they are, said once.
function findings(host: Host, { job, ticket, folder, root }: Merged, passed: Passed): string[] {
	const path = `${folder}/findings.md`;
	const answers = host.collectEach("findings.onMerge", { project: job.project, ticket: ticket.id, path, root, ...passed });
	if (answers.length === 0)
		return [existsSync(join(root, path)) ? `- Findings: ${path} left as it is, every open entry still open: no plugin provides findings.onMerge` : "- Findings: none; no findings.md on this ticket."];
	return answers.flatMap((answer) => {
		if ("error" in answer) return [`- Findings: findings.onMerge of ${answer.plugin} failed: ${answer.error.message}; ${path} left as it is`];
		return typeof answer.value === "string" && answer.value.trim() !== "" ? answer.value.trim().split("\n") : [`- Findings: findings.onMerge of ${answer.plugin} answered no lines`];
	});
}

// The `- (<kind>) <file:line>: <title>. <what>` lines under `## Notes` of the branch's last filed PASS review (roles/reviewer.md),
// and that review's job; none without one.
type Passed = { readonly review: string; readonly notes: readonly string[] };
function notesOf(files: readonly { readonly text: string }[], branch: string): Passed {
	const text = files.findLast(({ text }) => text.includes(`\n- Branch: ${branch}\n`) && /^- Verdict: PASS$/m.test(text))?.text ?? "";
	const section = text.split(/^## Notes[ \t]*$/m)[1]?.split(/^#{1,2} /m)[0] ?? "";
	return { review: /^- Job: (.+)$/m.exec(text)?.[1] ?? "", notes: section.split("\n").filter((line) => /^- \(\w+\) /.test(line)) };
}

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Host, Ticket } from "@arthur/core/plugin";

// `arthur stats` (spec/roadmap.md, entry 61): per merged ticket of a project its review rounds, verdicts, cost and days, then
// the mean rounds, the share of first-round PASS, the share of autopilot, the 3 most expensive and the first line of each
// finding of a FAIL review. Read only, from the board and the files in each ticket's folder. docs/commands/stats.md.

const REVIEW = /^review-(\d+)\.md$/;
const DAY_MS = 86_400_000;
const TOP = 3;
// A Findings heading of a review's final message (`## Findings`, `## Review Findings`, `**Findings**`, `Findings:`), and the
// next section's.
const FINDINGS = /^(?:#{1,6}\s+.*\bFindings\b.*|\*\*[^*]*\bFindings\b[^*]*\*\*:?|Findings:?)$/i;
const END = /^(?:#{1,6}\s|\*\*(?:Notes|Checks)\b)/i;
// How a finding opens: a number, bold (after a blank line), or a bullet.
const NUMBER = /^\d+[.)]\s/;
const BOLD = /^\*\*/;
const BULLET = /^[-*]\s/;

type Row = { readonly ticket: Ticket; readonly verdicts: readonly string[]; readonly cost?: number; readonly days?: number; readonly autopilot: boolean; readonly fails: readonly string[] };

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const share = (part: number, whole: number) => `${part} of ${whole} (${Math.round((part / whole) * 100)}%)`;

// The first line of each finding in a FAIL review's final message: each line of its Findings section that opens as the first
// one does; a section that opens with plain text is one finding; without a Findings heading, the message's first line.
export function findingLines(review: string): string[] {
	const lines = review.slice(review.indexOf("\n## Final message\n") + 1).split("\n").slice(1);
	const heading = lines.findIndex((line) => FINDINGS.test(line.trim()));
	if (heading === -1) return lines.map((line) => line.trim()).filter(Boolean).slice(0, 1);
	const after = lines.slice(heading + 1);
	const end = after.findIndex((line) => END.test(line));
	const section = end === -1 ? after : after.slice(0, end);
	const first = section.findIndex((line) => line.trim() !== "");
	const opening = section[first] ?? "";
	const kind = [NUMBER, BOLD, BULLET].find((each) => each.test(opening));
	if (kind === undefined) return opening === "" ? [] : [opening.trim()];
	return section.flatMap((line, index) => (kind.test(line) && (kind !== BOLD || section[index - 1]?.trim() === "" || index === first) ? [line.trim()] : []));
}

function row(host: Pick<Host, "clock">, ticket: Ticket, root: string): Row {
	const folder = join(root, dirname(ticket.path));
	const text = read(join(root, ticket.path));
	const reviews = existsSync(folder)
		? readdirSync(folder)
				.filter((name) => REVIEW.test(name))
				.sort((a, b) => Number(REVIEW.exec(a)?.[1]) - Number(REVIEW.exec(b)?.[1]))
				.map((name) => ({ name: name.slice(0, -".md".length), text: read(join(folder, name)) }))
		: [];
	const verdicts = reviews.map((review) => /^- Verdict: (PASS|FAIL)$/m.exec(review.text)?.[1] ?? "none");
	// The outcome's `- Cost:` line, worker and reviews; a missing file or line, or either amount `n/a`, is unknown.
	const cost = /^- Cost: worker \$(\d+(?:\.\d+)?), reviews \$(\d+(?:\.\d+)?)/m.exec(read(join(folder, "outcome.md")));
	// From the day the ticket was made, its JSON block's `date`, to the day of its last move, to merged.
	const made = /^\s*"date":\s*"(\d{4}-\d{2}-\d{2})"/m.exec(text)?.[1];
	const moved = new Date(ticket.updated);
	const days = made === undefined || Number.isNaN(moved.getTime()) ? Number.NaN : (Date.parse(host.clock.local(moved).date) - Date.parse(made)) / DAY_MS;
	return {
		ticket,
		verdicts,
		...(cost === null ? {} : { cost: Number(cost[1]) + Number(cost[2]) }),
		...(Number.isFinite(days) ? { days: Math.round(days) } : {}),
		autopilot: /^- \d{4}-\d{2}-\d{2}: Pre-approved by policy:/m.test(text),
		fails: reviews.flatMap((review, index) => (verdicts[index] === "FAIL" ? findingLines(review.text).map((line) => `${ticket.id} ${review.name}: ${line}`) : [])),
	};
}

// The stats of `project`, the main one when undefined; `host.board.list` refuses an unknown project, so `where` is found.
export function stats(host: Pick<Host, "board" | "clock">, project: string | undefined): string {
	const merged = host.board.list(project).filter((ticket) => ticket.status === "merged");
	const projects = host.board.projects();
	const where = (project === undefined ? projects[0] : projects.find((each) => each.name === project))!;
	if (merged.length === 0) return `No merged ticket in ${where.name} yet.`;
	const rows = merged.map((ticket) => row(host, ticket, where.path));
	const reviewed = rows.filter((each) => each.verdicts.length > 0);
	const known = rows.filter((each) => each.cost !== undefined).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
	const unknown = rows.length - known.length;
	const fails = rows.flatMap((each) => each.fails);
	return [
		`Stats of ${where.name}: ${plural(rows.length, "merged ticket")}`,
		...rows.map((each) =>
			[
				`${each.ticket.id} ${each.ticket.title}: ${each.verdicts.length === 0 ? "no review" : `${plural(each.verdicts.length, "round")} (${each.verdicts.join(", ")})`}`,
				each.cost === undefined ? "cost unknown" : `$${each.cost.toFixed(2)}`,
				each.days === undefined ? "days unknown" : plural(each.days, "day"),
				...(each.autopilot ? ["autopilot"] : []),
			].join(", "),
		),
		"",
		`Mean review rounds: ${reviewed.length === 0 ? "no ticket reviewed" : `${(reviewed.reduce((sum, each) => sum + each.verdicts.length, 0) / reviewed.length).toFixed(1)} over ${plural(reviewed.length, "reviewed ticket")}`}`,
		`First-round PASS: ${reviewed.length === 0 ? "no ticket reviewed" : `${share(reviewed.filter((each) => each.verdicts[0] === "PASS").length, reviewed.length)} reviewed`}`,
		`Autopilot: ${share(rows.filter((each) => each.autopilot).length, rows.length)} merged`,
		`Most expensive: ${known.length === 0 ? "no ticket with a known cost" : known.slice(0, TOP).map((each) => `${each.ticket.id} $${each.cost?.toFixed(2)}`).join(", ")}${unknown === 0 ? "" : `; cost unknown for ${plural(unknown, "ticket")}`}`,
		`FAIL findings:${fails.length === 0 ? " none" : ""}`,
		...fails.map((line) => `- ${line}`),
	].join("\n");
}

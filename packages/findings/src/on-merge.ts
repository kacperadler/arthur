import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Finding, readFindings, settle } from "./findings-file.ts";
import type { Mode } from "./findings-options.ts";

// `findings.onMerge` (spec/roadmap.md, entry 83), which `arthur merge` asks with the merged ticket's `findings.md` and its passed
// review's notes: each note of a kind it files appended as an open entry, each open entry settled as the project's mode says,
// `findings.md` written whole once, and the lines of the outcome's `## Left open` answered. docs/findings.md, "At a merge".

export type Merged = { readonly project: string; readonly ticket: string; readonly path: string; readonly root: string; readonly review?: string; readonly notes?: readonly string[] };

// An amount in USD, as autopilot reads a ticket's `budget`.
const AMOUNT = /^\d+(\.\d+)?$/;
// A review's note, `- (<kind>) <file:line>: <title>. <what>` (delivery's roles/reviewer.md), of a kind a merge files, and the
// entry's Kind for each.
const NOTE = /^- \((security|bug|risk)\) `?(\S+?)`?: (.+?)(?:\. (.+))?$/;
const KINDS: Readonly<Record<string, string>> = { security: "security", bug: "fix", risk: "fix" };
const TEMPLATE = new URL("../templates/findings.md", import.meta.url);

export function onMerge(host: Host, mode: Mode, { project, ticket, path, root, review = "", notes = [] }: Merged): string {
	const file = join(root, path);
	const today = host.clock.local().date;
	const had = existsSync(file) ? readFileSync(file, "utf8") : undefined;
	const base = had ?? readFileSync(TEMPLATE, "utf8").split(/^## F/m)[0]?.replace("{{id}}", ticket) ?? "";
	const text = withNotes(base, review, notes, today);
	if (had === undefined && text === base) return "- Findings: none; no findings.md on this ticket.";
	const open = readFindings(text).filter((finding) => finding.status === "open");
	if (open.length === 0) return "- Tickets from findings: none open.";
	if (mode === "summary") {
		settle(file, text, open.map((finding) => [finding, "deferred (client summary)"]));
		return open.map((finding) => `- Deferred (client summary): F${finding.n}. ${finding.title}`).join("\n");
	}
	const source = (finding: Finding) => `- ${today}: Source: F${finding.n} of ${ticket}`;
	const groups: readonly (readonly Finding[])[] = mode === "grouped" ? [open] : open.map((finding) => [finding]);
	const made: [Finding, string][] = [];
	const tickets: string[] = [];
	const failed: string[] = [];
	for (const group of groups) {
		const [first] = group;
		if (first === undefined) continue;
		const named = group.map((finding) => `F${finding.n}`).join(", ");
		const title = mode === "grouped" ? `Findings of ${ticket}: ${host.board.get(ticket)?.title ?? path}` : first.title;
		const description =
			mode === "grouped"
				? [`The open findings of ${ticket} (${path}), made one ticket at its merge.`, ...group.map((finding) => `### F${finding.n}. ${finding.title}\n\n${finding.body}`)].join("\n\n")
				: `F${first.n} of ${ticket} (${path}).\n\n${first.body}`;
		const kind = group.every((finding) => finding.kind === first.kind) && host.board.kinds.includes(first.kind ?? "") ? first.kind : undefined;
		const budget = group.every((finding) => AMOUNT.test(finding.budget ?? "")) ? Math.round(group.reduce((sum, finding) => sum + Number(finding.budget), 0) * 100) / 100 : undefined;
		let created: { readonly id: string; readonly path: string };
		try {
			created = host.board.create(title, project);
		} catch (error) {
			failed.push(`- Findings: ${named} left open, no ticket made: ${(error as Error).message}`);
			continue;
		}
		fill(join(root, created.path), description, kind, budget, group.map(source));
		for (const finding of group) made.push([finding, `ticket ${created.id}`]);
		tickets.push(`${created.id} (${named})`);
	}
	if (made.length > 0 || text !== had) settle(file, text, made);
	return [...(tickets.length > 0 ? [`- Tickets from findings: ${tickets.join(", ")}.`] : []), ...failed].join("\n");
}

// `text` with an open entry for each note of a kind a merge files, numbered after its last entry; unchanged when it already
// holds an entry this review found, so a merge asked again files no note twice.
function withNotes(text: string, review: string, notes: readonly string[], today: string): string {
	const found = `- Found by: ${review} (review), `;
	if (text.includes(found)) return text;
	let n = Math.max(0, ...readFindings(text).map((finding) => finding.n));
	const entries = notes.flatMap((note) => {
		const [, kind = "", where = "", title = "", what] = NOTE.exec(note) ?? [];
		if (kind === "") return [];
		n += 1;
		return [`## F${n}. ${title.replace(/\.$/, "")}\n\n- Kind: ${KINDS[kind]}\n${found}${today}\n- Where: \`${where}\`\n- What: ${what ?? title}\n- Status: open\n`];
	});
	return entries.length === 0 ? text : `${text.replace(/\n*$/, "\n\n")}${entries.join("\n")}`;
}

// The new ticket's `ticket.md`, the core's template: its Description the finding, its kind and its Decisions the source lines,
// and `budget` in its JSON block when every finding names one; the rest of the template's guidance is the coordinator's.
function fill(file: string, description: string, kind: string | undefined, budget: number | undefined, sources: readonly string[]): void {
	let text = readFileSync(file, "utf8");
	text = text.replace(/(## Description\n\n)<!--[\s\S]*?-->/, (_, head: string) => head + description);
	if (kind !== undefined) text = text.replace(/^(- Kind: )<!--[\s\S]*?-->$/m, (_, head: string) => head + kind);
	text = text.replace(/(## Decisions\n\n)<!--[\s\S]*?-->/, (_, head: string) => head + sources.join("\n"));
	if (budget !== undefined) text = text.replace(/```json\n([\s\S]*?)\n```/, (_, json: string) => `\`\`\`json\n${JSON.stringify({ ...JSON.parse(json), budget }, null, 2)}\n\`\`\``);
	const temporary = `${file}.${process.pid}.tmp`;
	writeFileSync(temporary, text);
	renameSync(temporary, file);
}

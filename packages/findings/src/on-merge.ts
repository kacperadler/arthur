import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Finding, readFindings, settle } from "./findings-file.ts";
import type { Mode } from "./findings-options.ts";

// `findings.onMerge` (spec/roadmap.md, entry 83), which `arthur merge` asks with the merged ticket's `findings.md`: each open
// entry settled as the project's mode says, `findings.md` written whole once, and the lines of the outcome's `## Left open`
// answered. docs/findings.md, "At a merge".

export type Merged = { readonly project: string; readonly ticket: string; readonly path: string; readonly root: string };

// An amount in USD, as autopilot reads a ticket's `budget`.
const AMOUNT = /^\d+(\.\d+)?$/;

export function onMerge(host: Host, mode: Mode, { project, ticket, path, root }: Merged): string {
	const file = join(root, path);
	if (!existsSync(file)) return "- Findings: none; no findings.md on this ticket.";
	const text = readFileSync(file, "utf8");
	const open = readFindings(text).filter((finding) => finding.status === "open");
	if (open.length === 0) return "- Tickets from findings: none open.";
	if (mode === "summary") {
		settle(file, text, open.map((finding) => [finding, "deferred (client summary)"]));
		return open.map((finding) => `- Deferred (client summary): F${finding.n}. ${finding.title}`).join("\n");
	}
	const today = host.clock.local().date;
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
	if (made.length > 0) settle(file, text, made);
	return [...(tickets.length > 0 ? [`- Tickets from findings: ${tickets.join(", ")}.`] : []), ...failed].join("\n");
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

import { readFileSync } from "node:fs";

// The ticket templates that ship with the core (spec/roadmap.md, entry 17), in `packages/core/templates/`: `ticket.md`, written
// when a ticket is created, `review.md` and `outcome.md` for the entries that write them (`findings.md` is the findings plugin's).
// Guidance is every `<!-- ... -->` comment of a template: the writer replaces it with the ticket's own text.

const TICKET = new URL("../templates/ticket.md", import.meta.url);
const GUIDANCE = /<!--[\s\S]*?-->/g;
const SLUG_MAX = 80;

// One line with a letter or a digit; the ticket's folder name is made from it.
export function checkTitle(title: string): string | undefined {
	if (title.trim() !== title || title === "") return "a title is one line of text, without spaces around it";
	if (/[\r\n]/.test(title)) return "a title is one line of text";
	if (slug(title) === "") return "a title needs a letter a-z or a digit, for its folder name";
	return undefined;
}

// `Two writers, one board!` is `two-writers-one-board`, cut at a dash to at most 80 characters.
export function slug(title: string): string {
	const full = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	if (full.length <= SLUG_MAX) return full;
	const cut = full.slice(0, SLUG_MAX + 1);
	const dash = cut.lastIndexOf("-");
	return dash > 0 ? cut.slice(0, dash) : cut.slice(0, SLUG_MAX);
}

export function ticketText(id: string, title: string, date: string): string {
	const json = JSON.stringify({ id, title, date }, null, 2);
	return readFileSync(TICKET, "utf8").replace(/\{\{(id|title|json)\}\}/g, (_, key: string) => (key === "id" ? id : key === "title" ? title : json));
}

// The kinds a ticket's `- Kind:` line under its Goal may name, as the template lists them.
export const KINDS: readonly string[] = ["feat", "fix", "security", "perf", "refactor", "test", "docs", "build", "ci", "chore", "ux"];

// The `- Kind:` line under the ticket's `## Goal`, as written; undefined without one.
export function ticketKind(text: string): string | undefined {
	return /^- Kind:(.*)$/m.exec(text.split(/^## Goal$/m)[1]?.split(/^## /m)[0] ?? "")?.[1]?.trim();
}

// Why `text` may not be planned yet: the template's guidance left in it, as written there; else a Kind none of KINDS.
export function notPlanned(text: string): string | undefined {
	const guidance = new Set(readFileSync(TICKET, "utf8").match(GUIDANCE) ?? []);
	const left = [...guidance].filter((comment) => text.includes(comment));
	if (left.length > 0) return `still holds the template's guidance, replace it first:\n${left.join("\n")}`;
	const kind = ticketKind(text);
	return kind === undefined || KINDS.includes(kind) ? undefined : `names Kind ${JSON.stringify(kind)}, none of the template's: ${KINDS.join(", ")}`;
}

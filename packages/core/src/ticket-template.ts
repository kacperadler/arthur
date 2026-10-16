import { readFileSync } from "node:fs";

// The ticket templates that ship with the core (spec/roadmap.md, entry 17), in `packages/core/templates/`: `ticket.md`,
// written when a ticket is created, and `findings.md`, `review.md`, `outcome.md` for the entries that write those files.
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

// The template's guidance still in `text`, each as written in the template.
export function guidanceLeft(text: string): string[] {
	const guidance = new Set(readFileSync(TICKET, "utf8").match(GUIDANCE) ?? []);
	return [...guidance].filter((comment) => text.includes(comment));
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openAfter } from "./board-after.ts";
import { type Entry, STATUSES } from "./board-file.ts";
import { KINDS, ticketKind } from "./ticket-template.ts";

// The board as text and its digest (docs/commands/ticket.md); open tickets of one status in the order of creation. `root`
// is the project's folder, where each ticket's Kind is read; with `kind`, only the tickets of that Kind.

const NEWEST_MERGED = 10;

export function boardText(root: string, entries: readonly Entry[], all: boolean, kind?: string): string {
	if (kind !== undefined && !KINDS.includes(kind)) throw new Error(`unknown kind ${kind}; kinds: ${KINDS.join(", ")}`);
	if (entries.length === 0) return "the board is empty";
	const listed = kind === undefined ? entries : entries.filter((entry) => kindOf(root, entry) === kind);
	if (listed.length === 0) return `no ticket of kind ${kind}`;
	const merged = listed.filter((entry) => entry.status === "merged").sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
	const dropped = listed.filter((entry) => entry.status === "dropped");
	const open = STATUSES.flatMap((status) => (status === "merged" || status === "dropped" ? [] : listed.filter((entry) => entry.status === status)));
	const shown = all ? [...open, ...merged, ...dropped] : [...open, ...merged.slice(0, NEWEST_MERGED)];
	const lines = shown.map((entry) => {
		const waits = entry.status === "merged" || entry.status === "dropped" ? [] : openAfter(entries, entry.after);
		return `${entry.id} ${entry.status.padEnd(11)} ${(kind ?? kindOf(root, entry)).padEnd(8)} ${entry.title}${waits.length > 0 ? `  after ${waits.join(", ")}` : ""}`;
	});
	const older = merged.length - Math.min(merged.length, NEWEST_MERGED);
	const rest = [older > 0 ? `${older} older merged` : "", dropped.length > 0 ? `${dropped.length} dropped` : ""].filter(Boolean).join(", ");
	if (!all && rest !== "") lines.push(`+ ${rest}: the full board is /board all`);
	return lines.join("\n");
}

// The one word of the ticket's `- Kind:` line, as written; `-` without one, or when its ticket.md cannot be read.
function kindOf(root: string, entry: Entry): string {
	let text: string;
	try {
		text = readFileSync(join(root, entry.path), "utf8");
	} catch {
		return "-";
	}
	const word = ticketKind(text) ?? "";
	return /^\S+$/.test(word) ? word : "-";
}

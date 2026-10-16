import { openAfter } from "./board-after.ts";
import { type Entry, STATUSES } from "./board-file.ts";

// The board as text and its digest (docs/commands/ticket.md); open tickets of one status in the order of creation.

const NEWEST_MERGED = 10;

export function boardText(entries: readonly Entry[], all: boolean): string {
	if (entries.length === 0) return "the board is empty";
	const merged = entries.filter((entry) => entry.status === "merged").sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
	const dropped = entries.filter((entry) => entry.status === "dropped");
	const open = STATUSES.flatMap((status) => (status === "merged" || status === "dropped" ? [] : entries.filter((entry) => entry.status === status)));
	const shown = all ? [...open, ...merged, ...dropped] : [...open, ...merged.slice(0, NEWEST_MERGED)];
	const lines = shown.map((entry) => {
		const waits = entry.status === "merged" || entry.status === "dropped" ? [] : openAfter(entries, entry.after);
		return `${entry.id} ${entry.status.padEnd(11)} ${entry.title}${waits.length > 0 ? `  after ${waits.join(", ")}` : ""}`;
	});
	const older = merged.length - Math.min(merged.length, NEWEST_MERGED);
	const rest = [older > 0 ? `${older} older merged` : "", dropped.length > 0 ? `${dropped.length} dropped` : ""].filter(Boolean).join(", ");
	if (!all && rest !== "") lines.push(`+ ${rest}: the full board is /board all`);
	return lines.join("\n");
}

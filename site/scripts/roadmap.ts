import { repo } from "./markdown.ts";

export type Entry = { readonly number: number; readonly title: string; readonly line: number };
export type Section = { readonly title: string; readonly entries: readonly Entry[] };
export type Ticket = {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly path: string;
	readonly updated?: string;
};

/** The roadmap's `## <section>` and `### <N>. <title>` headings; a section without numbered entries is left out. */
export function parseRoadmap(text: string): Section[] {
	const sections: { title: string; entries: Entry[] }[] = [];
	const seen = new Map<number, number>();
	text.split("\n").forEach((line, index) => {
		const section = /^## (.+)$/.exec(line);
		if (section !== null) sections.push({ title: section[1].trim(), entries: [] });
		const entry = /^### (\d+)\. (.+)$/.exec(line);
		if (entry === null) return;
		const number = Number(entry[1]);
		const first = seen.get(number);
		if (first !== undefined) {
			throw new Error(`spec/roadmap.md: entry ${number} is used twice, at lines ${first} and ${index + 1}`);
		}
		seen.set(number, index + 1);
		if (sections.length === 0) throw new Error(`spec/roadmap.md:${index + 1}: entry ${number} is under no section`);
		sections[sections.length - 1].entries.push({ number, title: entry[2].trim(), line: index + 1 });
	});
	if (seen.size === 0) throw new Error("spec/roadmap.md: no numbered entry (### <N>. <title>)");
	return sections.filter((section) => section.entries.length > 0);
}

/** The board file, checked: an array of tickets, each with `id`, `title`, `status` and `path`. */
export function parseBoard(text: string): Ticket[] {
	const board: unknown = JSON.parse(text);
	if (!Array.isArray(board)) throw new Error("spec/build.json: not an array of tickets");
	board.forEach((ticket: unknown, index) => {
		const fields = ticket !== null && typeof ticket === "object" ? (ticket as Record<string, unknown>) : {};
		for (const key of ["id", "title", "status", "path"]) {
			if (typeof fields[key] !== "string") throw new Error(`spec/build.json: ticket ${index} has no string ${key}`);
		}
	});
	return board as Ticket[];
}

const open = (ticket: Ticket) => ticket.status !== "merged" && ticket.status !== "dropped";
const entryOf = (ticket: Ticket) => /^Roadmap (\d+):/.exec(ticket.title)?.[1];

/** The ticket that stands for each entry: a merged one, otherwise the most recently updated open one. */
export function joinBoard(sections: readonly Section[], board: readonly Ticket[]): Map<number, Ticket> {
	const numbers = new Set(sections.flatMap((section) => section.entries.map((entry) => entry.number)));
	const chosen = new Map<number, Ticket>();
	for (const ticket of board) {
		const entry = entryOf(ticket);
		if (entry === undefined) continue;
		const number = Number(entry);
		if (!numbers.has(number)) {
			throw new Error(`spec/build.json: ${ticket.id} (${ticket.title}) names entry ${number}, which spec/roadmap.md does not have`);
		}
		const current = chosen.get(number);
		if (ticket.status === "merged") {
			if (current?.status !== "merged") chosen.set(number, ticket);
		} else if (open(ticket) && (current === undefined || (open(current) && (ticket.updated ?? "") > (current.updated ?? "")))) {
			chosen.set(number, ticket);
		}
	}
	return chosen;
}

const ticketUrl = `${repo}/blob/main/`;

/** The roadmap page's body: one table per section, then the open tickets that are not roadmap entries. */
export function roadmapPage(sections: readonly Section[], board: readonly Ticket[]): string {
	const chosen = joinBoard(sections, board);
	const parts = sections.map((section) => {
		const built = section.entries.filter((entry) => chosen.get(entry.number)?.status === "merged").length;
		const rows = section.entries.map((entry) => {
			const ticket = chosen.get(entry.number);
			const state = ticket === undefined ? "not started" : ticket.status === "merged" ? "built" : ticket.status;
			const cells = [entry.number, entry.title.replaceAll("|", "\\|"), state];
			return `| ${cells.join(" | ")} | ${ticket === undefined ? "" : `[${ticket.id}](${ticketUrl}${ticket.path})`} |`;
		});
		const head = `## ${section.title}: ${built} of ${section.entries.length} built`;
		return [head, "", "| Entry | Title | State | Ticket |", "| --- | --- | --- | --- |", ...rows].join("\n");
	});
	const others = board.filter((ticket) => open(ticket) && entryOf(ticket) === undefined);
	const rows = others.map(
		(ticket) => `| [${ticket.id}](${ticketUrl}${ticket.path}) | ${ticket.title.replaceAll("|", "\\|")} | ${ticket.status} |`,
	);
	const table = rows.length === 0 ? ["None."] : ["| Ticket | Title | Status |", "| --- | --- | --- |", ...rows];
	return [...parts, ["## Other open tickets", "", ...table].join("\n")].join("\n\n");
}

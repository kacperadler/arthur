import { repo } from "./markdown.ts";

export type Entry = { readonly number: number; readonly title: string; readonly line: number; readonly tickets: readonly string[] };
export type Section = { readonly title: string; readonly entries: readonly Entry[] };
export type Ticket = {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly path: string;
	readonly updated?: string;
};

/** The roadmap's `## <section>` and `### <N>. <title>` headings, and each entry's `- Tickets: <id>, <id>` lines; a section without entries is left out. */
export function parseRoadmap(text: string): Section[] {
	const sections: { title: string; entries: Entry[] }[] = [];
	const seen = new Map<number, number>();
	let current: { number: number; tickets: string[] } | undefined;
	text.split("\n").forEach((line, index) => {
		const section = /^## (.+)$/.exec(line);
		if (section !== null) {
			sections.push({ title: section[1].trim(), entries: [] });
			current = undefined;
		}
		const tickets = /^- Tickets: (.+)$/.exec(line);
		if (tickets !== null && current !== undefined) {
			for (const id of tickets[1].split(",").map((word) => word.trim())) {
				if (!/^[A-Z]+\d+$/.test(id)) throw new Error(`spec/roadmap.md:${index + 1}: entry ${current.number} names "${id}", which is not a ticket id`);
				current.tickets.push(id);
			}
		}
		const entry = /^### (\d+)\. (.+)$/.exec(line);
		if (entry === null) return;
		const number = Number(entry[1]);
		const first = seen.get(number);
		if (first !== undefined) {
			throw new Error(`spec/roadmap.md: entry ${number} is used twice, at lines ${first} and ${index + 1}`);
		}
		seen.set(number, index + 1);
		if (sections.length === 0) throw new Error(`spec/roadmap.md:${index + 1}: entry ${number} is under no section`);
		current = { number, tickets: [] };
		sections[sections.length - 1].entries.push({ number, title: entry[2].trim(), line: index + 1, tickets: current.tickets });
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

/** The ticket that stands for each entry, by its title (`Roadmap <N>:`) or the entry's `- Tickets:`: a merged one, else the most recently updated open one. */
export function joinBoard(sections: readonly Section[], board: readonly Ticket[]): Map<number, Ticket> {
	const entries = sections.flatMap((section) => section.entries);
	const numbers = new Set(entries.map((entry) => entry.number));
	const ids = new Set(board.map((ticket) => ticket.id));
	const named = new Map<string, number[]>();
	for (const entry of entries) {
		for (const id of entry.tickets) {
			if (!ids.has(id)) throw new Error(`spec/roadmap.md:${entry.line}: entry ${entry.number} names ${id}, which spec/build.json does not have`);
			named.set(id, [...(named.get(id) ?? []), entry.number]);
		}
	}
	const chosen = new Map<number, Ticket>();
	for (const ticket of board) {
		const entry = entryOf(ticket);
		if (entry !== undefined && !numbers.has(Number(entry))) {
			throw new Error(`spec/build.json: ${ticket.id} (${ticket.title}) names entry ${entry}, which spec/roadmap.md does not have`);
		}
		for (const number of [...(entry === undefined ? [] : [Number(entry)]), ...(named.get(ticket.id) ?? [])]) {
			const current = chosen.get(number);
			const newer = current === undefined || (open(current) && (ticket.updated ?? "") > (current.updated ?? ""));
			if (ticket.status === "merged" || (open(ticket) && newer)) chosen.set(number, ticket);
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
	const named = new Set(sections.flatMap((section) => section.entries.flatMap((entry) => entry.tickets)));
	const others = board.filter((ticket) => open(ticket) && entryOf(ticket) === undefined && !named.has(ticket.id));
	const rows = others.map(
		(ticket) => `| [${ticket.id}](${ticketUrl}${ticket.path}) | ${ticket.title.replaceAll("|", "\\|")} | ${ticket.status} |`,
	);
	const table = rows.length === 0 ? ["None."] : ["| Ticket | Title | Status |", "| --- | --- | --- |", ...rows];
	return [...parts, ["## Other open tickets", "", ...table].join("\n")].join("\n\n");
}

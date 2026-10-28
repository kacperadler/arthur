import { readFileSync, renameSync, writeFileSync } from "node:fs";

// The board file of one project, `spec/build.json` (spec/roadmap.md, entry 17): a JSON array of tickets, in the order they
// were created. A file broken by hand is refused, naming the file and the first problem, and never written over. Keys the
// board does not read (a later entry's) are kept as written.

export const STATUSES = ["planning", "planned", "in-progress", "review", "done", "merged", "dropped"] as const;

export type Status = (typeof STATUSES)[number];

// The allowed moves: `planned` is the human's approval, so the work starts only from it; merged and dropped are final.
export const NEXT: Readonly<Record<Status, readonly Status[]>> = {
	planning: ["planned", "dropped"],
	planned: ["planning", "in-progress", "dropped"],
	"in-progress": ["planning", "review", "done", "merged", "dropped"],
	review: ["in-progress", "done", "merged", "dropped"],
	done: ["in-progress", "review", "merged", "dropped"],
	merged: [],
	dropped: [],
};

// `path`: the ticket's `ticket.md`, from the project's folder, in the one shape `arthur ticket new` writes so a filing beside it
// stays in the project (AR0484); `updated`: when it was created or last moved, ISO 8601; `after`: the ids it waits for, if any.
export type Entry = {
	readonly id: string;
	readonly title: string;
	readonly status: Status;
	readonly path: string;
	readonly updated: string;
	readonly after?: readonly string[];
};

export const ID = /^([A-Z]+)(\d{4,})$/;

// A missing file is an empty board.
export function readBoard(file: string): Entry[] {
	let text: string;
	try {
		text = readFileSync(file, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const broken = (problem: string) =>
		new Error(`${file}: ${problem}; the board is refused and left as it is: fix the file by hand, or restore it from Git`);
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		throw broken(`not JSON (${(error as Error).message})`);
	}
	if (!Array.isArray(value)) throw broken("expected an array of tickets");
	const seen = new Set<string>();
	value.forEach((entry: unknown, index) => {
		const problem = entryProblem(entry);
		if (problem !== undefined) throw broken(`[${index}]${problem}`);
		const { id } = entry as Entry;
		if (seen.has(id)) throw broken(`[${index}].id: ${id} is on the board twice`);
		seen.add(id);
	});
	return value as Entry[];
}

// Written whole to `temporary`, on the board's filesystem, then renamed over the board, so a reader never sees half a board.
export function writeBoard(file: string, entries: readonly Entry[], temporary: string): void {
	writeFileSync(temporary, `${JSON.stringify(entries, null, 2)}\n`);
	renameSync(temporary, file);
}

function entryProblem(entry: unknown): string | undefined {
	if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return ": expected a ticket object";
	const { id, title, status, path, updated, after } = entry as Record<string, unknown>;
	if (typeof id !== "string" || !ID.test(id)) return `.id: expected a prefix in capitals and a number of 4 digits or more, got ${describe(id)}`;
	if (typeof title !== "string" || title === "") return ".title: expected a non-empty string";
	if (!STATUSES.includes(status as Status)) return `.status: expected one of ${STATUSES.join(", ")}, got ${describe(status)}`;
	if (typeof path !== "string" || !new RegExp(`^spec/features/${id}-[a-z0-9-]+/ticket\\.md$`).test(path)) return `.path: expected spec/features/${id}-<slug>/ticket.md, a slug of a-z, 0-9 and -, got ${describe(path)}`;
	if (typeof updated !== "string" || Number.isNaN(Date.parse(updated))) return ".updated: expected an ISO 8601 time";
	if (after !== undefined && (!Array.isArray(after) || !after.every((each) => typeof each === "string" && ID.test(each))))
		return `.after: expected a list of ticket ids, got ${describe(after)}`;
	return undefined;
}

function describe(value: unknown): string {
	return value === undefined ? "nothing" : JSON.stringify(value);
}

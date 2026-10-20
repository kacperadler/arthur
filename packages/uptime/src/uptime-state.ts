import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// What a restart must not lose (spec/roadmap.md, entry 98), in `<folder>/state.json`: each site that is down, since when and
// why it was told, by `<project> <url>`, and since when no site answers. Written to a temporary name and renamed.

export type Down = { readonly since: string; readonly reason: string };
export type State = { readonly down: Readonly<Record<string, Down>>; readonly offline?: string };

const date = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

// A file that is not what `writeState` writes (missing, broken, edited by hand) is taken as no site down; an entry that is
// not a site down, as none.
export function readState(folder: string): State {
	let file: unknown;
	try {
		file = JSON.parse(readFileSync(join(folder, "state.json"), "utf8"));
	} catch {
		return { down: {} };
	}
	if (typeof file !== "object" || file === null || !("down" in file) || typeof file.down !== "object" || file.down === null) return { down: {} };
	const down = Object.entries(file.down).filter((entry): entry is [string, Down] => {
		const each: unknown = entry[1];
		return typeof each === "object" && each !== null && "since" in each && date(each.since) && "reason" in each && typeof each.reason === "string";
	});
	const offline = "offline" in file && date(file.offline) ? { offline: file.offline } : {};
	return { down: Object.fromEntries(down.map(([key, { since, reason }]) => [key, { since, reason }])), ...offline };
}

export function writeState(folder: string, state: State): void {
	const file = join(folder, "state.json");
	writeFileSync(`${file}.tmp`, `${JSON.stringify(state, null, "\t")}\n`);
	renameSync(`${file}.tmp`, file);
}

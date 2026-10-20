import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// What a restart must not lose (spec/roadmap.md, entry 57), in `<folder>/state.json`: for each project polled, the ids of the
// finished runs already told, or taken as told at its first poll. Written to a temporary name and renamed.

export type State = Readonly<Record<string, readonly number[]>>;

// A file that is not what `writeState` writes (missing, broken, edited by hand) is taken as no project polled yet; a
// project's entry that is not a list of ids, as that project not polled yet.
export function readState(folder: string): State {
	let file: unknown;
	try {
		file = JSON.parse(readFileSync(join(folder, "state.json"), "utf8"));
	} catch {
		return {};
	}
	if (typeof file !== "object" || file === null || Array.isArray(file)) return {};
	return Object.fromEntries(Object.entries(file).filter((entry): entry is [string, number[]] => Array.isArray(entry[1]) && entry[1].every((id) => Number.isInteger(id))));
}

export function writeState(folder: string, state: State): void {
	const file = join(folder, "state.json");
	writeFileSync(`${file}.tmp`, `${JSON.stringify(state)}\n`);
	renameSync(`${file}.tmp`, file);
}

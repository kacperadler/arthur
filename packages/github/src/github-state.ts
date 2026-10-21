import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// What a restart must not lose (spec/roadmap.md, entries 57 and 58), in `<folder>/state.json`: for each project polled, the
// run attempts already told, or taken as told at its first poll, each `<run id>/<run_attempt>` (AR0238: a rerun keeps its id);
// and, when pull request reviews are polled, when the project's last poll of them began (`polled`, ISO, whole seconds), and
// each open pull request's `updated_at` and the ids of its reviews told. Written to a temporary name and renamed.

export type Pull = { readonly updated: string; readonly told: readonly number[] };
export type Pulls = { readonly polled: string; readonly open: Readonly<Record<string, Pull>> };
export type State = { readonly runs: Readonly<Record<string, readonly string[]>>; readonly pulls: Readonly<Record<string, Pulls>> };

const ATTEMPT = /^\d+\/\d+$/;

// A file that is not what `writeState` writes (missing, broken, edited by hand, or entry 57's list of run ids) is taken as no
// project polled yet; a project's entry that is not what it should be (one written before AR0250 has no `polled`), as that
// project not polled yet.
export function readState(folder: string): State {
	let file: unknown;
	try {
		file = JSON.parse(readFileSync(join(folder, "state.json"), "utf8"));
	} catch {
		return { runs: {}, pulls: {} };
	}
	const record = (value: unknown): [string, unknown][] => (typeof value === "object" && value !== null && !Array.isArray(value) ? Object.entries(value) : []);
	const pull = (value: unknown) => {
		if (typeof value !== "object" || value === null) return false;
		const { updated, told } = value as Partial<Pull>;
		return typeof updated === "string" && Array.isArray(told) && told.every((id) => Number.isInteger(id));
	};
	const pulled = ([, value]: [string, unknown]) => {
		const { polled, open } = (typeof value === "object" && value !== null ? value : {}) as Partial<Pulls>;
		return typeof polled === "string" && Number.isFinite(Date.parse(polled)) && typeof open === "object" && open !== null && !Array.isArray(open) && Object.values(open).every(pull);
	};
	const [runs, pulls] = [(file as Partial<State> | null)?.runs, (file as Partial<State> | null)?.pulls];
	return {
		runs: Object.fromEntries(record(runs).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((key) => typeof key === "string" && ATTEMPT.test(key)))),
		pulls: Object.fromEntries(record(pulls).filter(pulled)) as State["pulls"],
	};
}

export function writeState(folder: string, state: State): void {
	const file = join(folder, "state.json");
	writeFileSync(`${file}.tmp`, `${JSON.stringify(state)}\n`);
	renameSync(`${file}.tmp`, file);
}

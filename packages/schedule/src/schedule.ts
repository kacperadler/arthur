import { describe } from "@arthur/core";
import type { OptionProblem, Options, Plugin } from "@arthur/core/plugin";
import { type Entry, entryProblems } from "./entry.ts";
import { sweeper } from "./sweep.ts";

// The schedule plugin (spec/roadmap.md, entry 39): actions and jobs at set times, from the config's `entries` and the `file`
// option, swept by `arthur run` and each due slot run once, its run state in `<home>/schedule/`: docs/schedule.md.

export type ScheduleOptions = { readonly enabled?: boolean; readonly file?: string; readonly entries?: readonly Entry[] };

const SWEEP_SECONDS = 10;

export function schedule(options: ScheduleOptions = {}): Plugin {
	let sweep = async () => {};
	let timer: NodeJS.Timeout | undefined;
	return {
		name: "schedule",
		options,
		check: checkOptions,
		setup(host) {
			const { file, entries = [] } = host.options as ScheduleOptions;
			const run = sweeper(host, entries, file, process.cwd());
			sweep = () => run().catch((error: Error) => console.error(`schedule: the sweep failed: ${error.message}`));
		},
		start() {
			void sweep();
			timer = setInterval(() => void sweep(), SWEEP_SECONDS * 1000);
		},
		stop() {
			clearInterval(timer);
		},
	};
}

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => key !== "file" && key !== "entries")
		.map((key) => ({ path: key, problem: "unknown option; options: file, entries" }));
	const { file, entries } = options;
	if (file !== undefined && !(typeof file === "string" && file.trim() !== "")) problems.push({ path: "file", problem: `expected the path of a JSON file, got ${describe(file)}` });
	if (entries === undefined) return problems;
	if (!Array.isArray(entries)) return [...problems, { path: "entries", problem: `expected a list of entries, got ${describe(entries)}` }];
	const ids: unknown[] = entries.map((entry: { readonly id?: unknown } | null) => entry?.id);
	for (const [index, entry] of entries.entries()) {
		problems.push(...entryProblems(entry, `entries[${index}]`));
		const first = ids.indexOf(ids[index]);
		if (typeof ids[index] === "string" && first < index) problems.push({ path: `entries[${index}].id`, problem: `${ids[index]} is the id of entries[${first}] too` });
	}
	return problems;
}

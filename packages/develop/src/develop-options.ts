import type { OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The develop plugin's options file (spec/roadmap.md, entries 66 and 93): it has none but `enabled`, which every plugin takes.
// docs/develop.md.

export const summary = "developing Arthur itself: arthur plugin new, a new plugin package that passes the checks as created";

export const tools: readonly Tool[] = [];

export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: "unknown option; develop has no options but enabled" }));
}

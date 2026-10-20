import type { OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The delivery plugin's options file (spec/roadmap.md, entries 52 and 93): review jobs take no option but `enabled`, which every
// plugin takes; the reviewer's model is orchestration's `roles.reviewer`. docs/commands/review.md.

export const summary = "review jobs of a worker's branch, their verdict moving the ticket, at most 2 FAILs before the owner decides";

// Git, which the review's checkout and its range need, is the core's tool.
export const tools: readonly Tool[] = [];

export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: "unknown option; delivery has no options but enabled" }));
}

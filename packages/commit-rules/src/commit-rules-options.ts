import type { OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The commit-rules plugin's options file (spec/roadmap.md, entries 43 and 93): it takes none but `enabled`; each project's rule
// is its `commitRules.project(...)` in its project file. docs/commit-rules.md.

export const summary = "each project's commit rule: a regex as a commit-msg hook in its job worktrees, words or a file in the worker's and reviewer's prompt";

export const tools: readonly Tool[] = [];

export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: "unknown option; commit-rules takes none: a project's rule is its commitRules.project(...) in its project file" }));
}

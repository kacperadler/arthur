import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The findings plugin's options file (spec/roadmap.md, entries 83 and 93), checked before any setup by walking `table`:
// docs/findings.md. Whether each key of `mode` names a project is the setup's to say, once the project list is there.

export const MODES = ["ticket", "grouped", "summary"] as const;
export type Mode = (typeof MODES)[number];
export type FindingsOptions = { readonly enabled?: boolean; readonly mode?: Readonly<Record<string, Mode>> };

export const summary = "each ticket's findings.md: its format, /findings, and what a merge makes of its open entries, per project";

export const tools: readonly Tool[] = [];

const modes: Check = (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? undefined : "an object of each project's mode, by the project's name");
const mode: Check = (value) => (MODES.includes(value as Mode) ? undefined : `one of ${MODES.join(", ")}`);

export const table: OptionTable = {
	mode: {
		about: "What a merge makes of each project's open findings, by the project's name: ticket (one planning ticket each), grouped (one for all), summary (none; deferred for the client)",
		default: "ticket for every project",
		check: modes,
	},
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	if (options.mode === undefined) return problems;
	if (modes(options.mode) !== undefined) return [...problems, { path: "mode", problem: `expected ${modes(options.mode)}, got ${describe(options.mode)}` }];
	for (const [project, value] of Object.entries(options.mode as Readonly<Record<string, unknown>>)) {
		const expected = mode(value);
		if (expected !== undefined) problems.push({ path: `mode.${project}`, problem: `project ${project}: expected ${expected}, got ${describe(value)}` });
	}
	return problems;
}

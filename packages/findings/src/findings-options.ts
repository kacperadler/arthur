import { describe } from "@arthur/core";
import type { OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The findings plugin's options file (spec/roadmap.md, entries 83 and 93), checked before any setup by walking `table`:
// docs/findings.md; and the check of a project's piece, its mode.

export const MODES = ["ticket", "grouped", "summary"] as const;
export type Mode = (typeof MODES)[number];
export type FindingsOptions = { readonly enabled?: boolean };

export const summary = "each ticket's findings.md: its format, /findings, and what a merge makes of its open entries, per project";

export const tools: readonly Tool[] = [];

// The plugin takes no option but `enabled`: a project's mode is its piece, `findings.project("summary")` in its project file.
export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: 'unknown option; findings takes none: a project\'s mode is its findings.project("summary") in its project file' }));
}

// A project's piece: what a merge makes of its open findings, ticket (one planning ticket each), grouped (one for all) or
// summary (none; deferred for the client); left out, ticket.
export const checkMode = (value: unknown): string | undefined => (MODES.includes(value as Mode) ? undefined : `expected one of ${MODES.join(", ")}, got ${describe(value)}`);

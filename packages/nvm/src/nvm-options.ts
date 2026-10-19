import type { OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The nvm plugin's options file (spec/roadmap.md, entries 84 and 93): it has none but `enabled`, which every plugin takes.
// docs/nvm.md.

export const summary = "each project's Node version from its .nvmrc, found by nvm on the job's machine and first on the job's PATH";

// nvm is a shell function, not a command with a version of its own; its doctor line asks `nvm --version` on each machine.
export const tools: readonly Tool[] = [];

export const table: OptionTable = {};

export function checkOptions(options: Options): OptionProblem[] {
	return Object.keys(options).map((key) => ({ path: key, problem: "unknown option; nvm has no options but enabled" }));
}

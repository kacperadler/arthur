import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The manage plugin's options file (spec/roadmap.md, entries 60 and 93), checked before any setup by walking `table`:
// docs/manage.md, "Options".

export type ManageOptions = { readonly enabled?: boolean; readonly health?: { readonly everyMinutes?: number } };

export const summary = "managing Arthur: arthur health and /health, what should have happened by now and has not, its new lines sent as a notice";

// Git, which the checks of each project's checkout run, is the core's tool.
export const tools: readonly Tool[] = [];

const every: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of minutes, 1 or more");

export const table: OptionTable = {
	health: {
		about: "The health checks of arthur health, also sent on their own while arthur run runs",
		fields: { everyMinutes: { about: "Minutes between two rounds of the checks under arthur run, each sending its new lines as one notice", default: "none: no round, only arthur health and /health", check: every } },
	},
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	const { health } = options;
	if (health === undefined) return problems;
	if (typeof health !== "object" || health === null || Array.isArray(health)) return [...problems, { path: "health", problem: `expected { everyMinutes }, got ${describe(health)}` }];
	for (const [key, value] of Object.entries(health)) {
		if (key !== "everyMinutes") problems.push({ path: `health.${key}`, problem: "unknown key; keys: everyMinutes" });
		else if (every(value) !== undefined) problems.push({ path: "health.everyMinutes", problem: `expected ${every(value)}, got ${describe(value)}` });
	}
	return problems;
}

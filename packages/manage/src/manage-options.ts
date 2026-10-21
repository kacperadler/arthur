import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The manage plugin's options file (spec/roadmap.md, entries 60, 64 and 93), checked before any setup by walking `table`:
// docs/manage.md, "Options".

export type ManageOptions = { readonly enabled?: boolean; readonly health?: { readonly everyMinutes?: number }; readonly prune?: { readonly keepJobsDays: number } };

export const summary = "managing Arthur: arthur health and /health, what should have happened by now and has not, its new lines sent as a notice; a daily prune of old jobs and temporary folders";

// Git, which the checks of each project's checkout run, is the core's tool.
export const tools: readonly Tool[] = [];

const every: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of minutes, 1 or more");
const days: Check = (value) => (Number.isInteger(value) && (value as number) >= 0 ? undefined : "a whole number of days, 0 or more");

export const table: OptionTable = {
	health: {
		about: "The health checks of arthur health, also sent on their own while arthur run runs",
		fields: { everyMinutes: { about: "Minutes between two rounds of the checks under arthur run, each sending its new lines as one notice", default: "none: no round, only arthur health and /health", check: every } },
	},
	prune: {
		about: "Each day at 03:00, through the schedule plugin: old ended jobs pruned as arthur prune does, and Arthur's temporary folders older than a day removed",
		fields: { keepJobsDays: { about: "Days an ended job is kept before the daily prune frees it", default: "none: no daily prune, and no temporary folder removed", check: days } },
	},
};

// An object option's one key, `key`, checked by `check`; `required` refuses the object without it.
function fields(options: Options, name: string, key: string, check: Check, required: boolean): OptionProblem[] {
	const value = options[name];
	if (value === undefined) return [];
	if (typeof value !== "object" || value === null || Array.isArray(value)) return [{ path: name, problem: `expected { ${key} }, got ${describe(value)}` }];
	const problems: OptionProblem[] = [];
	if (required && !(key in value)) problems.push({ path: `${name}.${key}`, problem: `expected ${check(undefined)}, got nothing` });
	for (const [each, field] of Object.entries(value)) {
		if (each !== key) problems.push({ path: `${name}.${each}`, problem: `unknown key; keys: ${key}` });
		else if (check(field) !== undefined) problems.push({ path: `${name}.${key}`, problem: `expected ${check(field)}, got ${describe(field)}` });
	}
	return problems;
}

export function checkOptions(options: Options): OptionProblem[] {
	return [
		...Object.keys(options).filter((key) => !Object.hasOwn(table, key)).map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` })),
		...fields(options, "health", "everyMinutes", every, false),
		...fields(options, "prune", "keepJobsDays", days, true),
	];
}

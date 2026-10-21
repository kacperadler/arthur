import { describe } from "@arthur/core";
import type { Day } from "@arthur/core/clock";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The manage plugin's options file (spec/roadmap.md, entries 60, 62, 63, 64 and 93), checked before any setup by walking
// `table`: docs/manage.md, "Options".

export type AuditOptions = { readonly at: string; readonly days?: readonly Day[]; readonly budgetUsd?: number; readonly model?: string | readonly string[] };
export type RetroOptions = { readonly day: Day; readonly at: string };
export type ManageOptions = {
	readonly enabled?: boolean;
	readonly health?: { readonly everyMinutes?: number };
	readonly prune?: { readonly keepJobsDays: number };
	readonly audit?: AuditOptions;
	readonly retro?: RetroOptions;
};

export const summary =
	"managing Arthur: arthur health and /health, what should have happened by now and has not, its new lines sent as a notice; a daily prune of old jobs and temporary folders; the nightly audit; the weekly retro, arthur retro-due and /retro";

// Git, which the checks of each project's checkout and the audit run, is the core's tool.
export const tools: readonly Tool[] = [];

// An audit's budget when `audit.budgetUsd` is left out: the audits of the harness Arthur replaces had 10.
export const AUDIT_BUDGET = 10;
const DAYS: readonly unknown[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const every: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of minutes, 1 or more");
const days: Check = (value) => (Number.isInteger(value) && (value as number) >= 0 ? undefined : "a whole number of days, 0 or more");
const at: Check = (value) => (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? undefined : '"HH:MM", 00:00 to 23:59');
const weekdays: Check = (value) =>
	Array.isArray(value) && value.length > 0 && value.every((day) => DAYS.includes(day)) && new Set(value).size === value.length ? undefined : `a non-empty list of ${DAYS.join(", ")}, each once`;
const weekday: Check = (value) => (DAYS.includes(value) ? undefined : `one of ${DAYS.join(", ")}`);
const usd: Check = (value) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? undefined : "an amount in USD, 0 or more (0 is no limit)");
const name = (value: unknown) => typeof value === "string" && value.trim() !== "";
const model: Check = (value) => (name(value) || (Array.isArray(value) && value.length > 0 && value.every(name)) ? undefined : "a model name, or a non-empty list of them");

export const table: OptionTable = {
	health: {
		about: "The health checks of arthur health, also sent on their own while arthur run runs",
		fields: { everyMinutes: { about: "Minutes between two rounds of the checks under arthur run, each sending its new lines as one notice", default: "none: no round, only arthur health and /health", check: every } },
	},
	prune: {
		about: "Each day at 03:00, through the schedule plugin: old ended jobs pruned as arthur prune does, and Arthur's temporary folders older than a day removed",
		fields: { keepJobsDays: { about: "Days an ended job is kept before the daily prune frees it", default: "none: no daily prune, and no temporary folder removed", check: days } },
	},
	audit: {
		about: "The audit, through the schedule plugin: a read-only job on the main project's commits since the last audit, with up to 5 proposals for tickets",
		default: "none: no scheduled audit",
		fields: {
			at: { about: "When it runs, in core.timeZone", check: at },
			days: { about: "The days it runs on", default: "every day", check: weekdays },
			budgetUsd: { about: "Its budget in USD, resumed once with it doubled when it runs out", default: String(AUDIT_BUDGET), check: usd },
			model: { about: "Its model, or an ordered list of them", default: "the auditor role's (orchestration's roles.auditor), else the agent's", check: model },
		},
	},
	retro: {
		about: "The retro, through the schedule plugin: a read-only job on the FAIL reviews, findings and outcomes of the merges since the last retro, with proposals for the roles and criteria; it starts only when arthur retro-due says due",
		default: "none: no scheduled retro",
		fields: {
			day: { about: "The day of the week it runs on", check: weekday },
			at: { about: "When it runs that day, in core.timeZone", check: at },
		},
	},
};

// An object option's keys, each checked by its own check; `required` refuses the object without them.
function fields(options: Options, option: string, checks: Readonly<Record<string, Check>>, required: readonly string[]): OptionProblem[] {
	const value = options[option];
	const keys = Object.keys(checks).join(", ");
	if (value === undefined) return [];
	if (typeof value !== "object" || value === null || Array.isArray(value)) return [{ path: option, problem: `expected { ${keys} }, got ${describe(value)}` }];
	const problems: OptionProblem[] = required.filter((key) => !(key in value)).map((key) => ({ path: `${option}.${key}`, problem: `expected ${checks[key]?.(undefined)}, got nothing` }));
	for (const [key, field] of Object.entries(value)) {
		const check = Object.hasOwn(checks, key) ? checks[key] : undefined;
		if (check === undefined) problems.push({ path: `${option}.${key}`, problem: `unknown key; keys: ${keys}` });
		else if (check(field) !== undefined) problems.push({ path: `${option}.${key}`, problem: `expected ${check(field)}, got ${describe(field)}` });
	}
	return problems;
}

export function checkOptions(options: Options): OptionProblem[] {
	return [
		...Object.keys(options).filter((key) => !Object.hasOwn(table, key)).map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` })),
		...fields(options, "health", { everyMinutes: every }, []),
		...fields(options, "prune", { keepJobsDays: days }, ["keepJobsDays"]),
		...fields(options, "audit", { at, days: weekdays, budgetUsd: usd, model }, ["at"]),
		...fields(options, "retro", { day: weekday, at }, ["day", "at"]),
	];
}

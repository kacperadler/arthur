import { isAbsolute, normalize, sep } from "node:path";
import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";
import { DAILY, isId, isObject, ONE_OFF } from "./entry.ts";

// The schedule plugin's options file (spec/roadmap.md, entries 39, 40 and 93), checked before any setup by walking `table`:
// docs/commands/schedule.md. `entryProblems` checks one entry, from the config, the `file` option or another plugin.

export const summary = "actions and jobs at set times: from the config, a JSON file, and entries other plugins register";

export const tools: readonly Tool[] = [];

const DAYS: readonly unknown[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const words: Check = (value) => (typeof value === "string" && value.trim() !== "" ? undefined : "non-empty text");

const ACTION: Readonly<Record<string, ValueOption>> = {
	message: { about: "The message to the coordinator, sent as [scheduled <id>] <message>", check: words },
	procedure: { about: "A .md file inside the folder arthur runs in, whose text goes under the message", check: words },
};
const JOB: Readonly<Record<string, ValueOption>> = {
	task: { about: "The job's task", check: words },
	kind: { about: "The job's kind", default: "worker", check: words },
	project: { about: "The project the job works on", default: "the main one", check: words },
};
const VALUES: Readonly<Record<"id" | "at" | "days", ValueOption>> = {
	id: { about: "The entry's id, which arthur schedule and its run state name it by", check: (value) => (isId(value) ? undefined : "letters and digits, joined by single dots, dashes or underscores") },
	at: {
		about: 'When it runs, in core.timeZone: "HH:MM" every day, or "YYYY-MM-DDTHH:MM" once',
		check: (value) => {
			const once = typeof value === "string" ? ONE_OFF.exec(value) : null;
			return (typeof value === "string" && DAILY.test(value)) || (once !== null && realDate(once[1] as string)) ? undefined : '"HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once';
		},
	},
	days: {
		about: "The days a daily entry runs on",
		default: "every day",
		check: (value) => (Array.isArray(value) && value.length > 0 && value.every((day) => DAYS.includes(day)) ? undefined : `a non-empty list of ${DAYS.join(", ")}`),
	},
};
const ENTRY: OptionTable = {
	...VALUES,
	action: { about: "A message to the coordinator; an entry has either action or job", fields: ACTION },
	job: { about: "A job to spawn; an entry has either action or job", fields: JOB },
};

const jsonFile: Check = (value) => (typeof value === "string" && value.trim() !== "" ? undefined : "the path of a JSON file");
const entryList: Check = (value) => (Array.isArray(value) ? undefined : "a list of entries");

export const table: OptionTable = {
	file: { about: "A JSON list of entries, read at every sweep, which arthur schedule add and remove change", check: jsonFile },
	entries: { about: "The entries of the config", check: entryList, each: ENTRY },
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	const { file, entries } = options;
	if (file !== undefined && jsonFile(file) !== undefined) problems.push({ path: "file", problem: `expected ${jsonFile(file)}, got ${describe(file)}` });
	if (entries === undefined) return problems;
	if (!Array.isArray(entries)) return [...problems, { path: "entries", problem: `expected ${entryList(entries)}, got ${describe(entries)}` }];
	const ids: unknown[] = entries.map((entry: { readonly id?: unknown } | null) => entry?.id);
	for (const [index, entry] of entries.entries()) {
		problems.push(...entryProblems(entry, `entries[${index}]`));
		const first = ids.indexOf(ids[index]);
		if (typeof ids[index] === "string" && first < index) problems.push({ path: `entries[${index}].id`, problem: `${ids[index]} is the id of entries[${first}] too` });
	}
	return problems;
}

// What keeps `entry` from running, each problem's path under `path` ("entries[0]", or "" for an entry of the file).
export function entryProblems(entry: unknown, path: string): OptionProblem[] {
	const under = (key: string) => (path === "" ? key : `${path}.${key}`);
	if (!isObject(entry)) return [{ path, problem: `expected an entry { id, at, action or job }, got ${describe(entry)}` }];
	const { at, days, action, job } = entry;
	const problems: OptionProblem[] = Object.keys(entry)
		.filter((key) => !Object.hasOwn(ENTRY, key))
		.map((key) => ({ path: under(key), problem: `unknown key; keys: ${Object.keys(ENTRY).join(", ")}` }));
	for (const key of ["id", "at"] as const) {
		const expected = VALUES[key].check(entry[key]);
		if (expected !== undefined) problems.push({ path: under(key), problem: `expected ${expected}, got ${describe(entry[key])}` });
	}
	const once = typeof at === "string" && ONE_OFF.test(at);
	const wrongDays = days === undefined ? undefined : VALUES.days.check(days);
	if (days !== undefined && once) problems.push({ path: under("days"), problem: "a one-off entry takes no days" });
	else if (wrongDays !== undefined) problems.push({ path: under("days"), problem: `expected ${wrongDays}, got ${describe(days)}` });
	if ((action === undefined) === (job === undefined)) problems.push({ path: under("action"), problem: "expected either action or job" });
	if (action !== undefined) problems.push(...fieldProblems(action, under("action"), ACTION, ["message"]));
	if (job !== undefined) problems.push(...fieldProblems(job, under("job"), JOB, ["task"]));
	const procedure = isObject(action) ? action.procedure : undefined;
	if (typeof procedure === "string" && procedure.trim() !== "" && !markdownInside(procedure))
		problems.push({ path: under("action.procedure"), problem: `expected the relative path of a .md file inside the folder arthur runs in, got ${describe(procedure)}` });
	return problems;
}

// An object of `fields`, `needed` the keys it must have.
function fieldProblems(value: unknown, path: string, fields: Readonly<Record<string, ValueOption>>, needed: readonly string[]): OptionProblem[] {
	if (!isObject(value)) return [{ path, problem: `expected an object with ${Object.keys(fields).join(", ")}, got ${describe(value)}` }];
	const problems = Object.keys(value)
		.filter((key) => !Object.hasOwn(fields, key))
		.map((key) => ({ path: `${path}.${key}`, problem: `unknown key; keys: ${Object.keys(fields).join(", ")}` }));
	for (const [key, entry] of Object.entries(fields)) {
		const expected = needed.includes(key) || value[key] !== undefined ? entry.check(value[key]) : undefined;
		if (expected !== undefined) problems.push({ path: `${path}.${key}`, problem: `expected ${expected}, got ${describe(value[key])}` });
	}
	return problems;
}

function markdownInside(path: string): boolean {
	const plain = normalize(path);
	return !isAbsolute(plain) && plain !== ".." && !plain.startsWith(`..${sep}`) && plain.endsWith(".md");
}

function realDate(date: string): boolean {
	return !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
}

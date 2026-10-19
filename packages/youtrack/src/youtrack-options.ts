import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The youtrack plugin's options file (spec/roadmap.md, entries 44 and 93), checked before any setup by walking `table`:
// docs/commands/youtrack.md, "Options". The variables' values, and each project's `tracker`, are checked at setup.

export const summary = "YouTrack servers, named and unnamed: each project's issues and articles, read through arthur youtrack";

export const tools: readonly Tool[] = [];

export const MAX_TIMEOUT = 300;

const variable: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "the name of an env variable");

const INSTANCE: Readonly<Record<string, ValueOption>> = {
	name: { about: "The instance's name, which a project's tracker.instance gives", default: "none: the unnamed instance", check: (value) => (typeof value === "string" && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value) ? undefined : "lowercase letters, digits and single dashes, from a letter") },
	urlEnv: { about: "The variable holding the server's URL, as https://example.youtrack.cloud", check: variable },
	tokenEnv: { about: "The variable holding a permanent token of the YouTrack user Arthur reads as", check: variable },
};

const instanceList: Check = (value) => (Array.isArray(value) && value.length > 0 ? undefined : "a list of at least one instance");
const seconds: Check = (value) => (typeof value === "number" && value > 0 && value <= MAX_TIMEOUT ? undefined : `a number of seconds above 0, at most ${MAX_TIMEOUT}`);

export const table: OptionTable = {
	instances: { about: "The YouTrack servers, each { name?, urlEnv, tokenEnv }; at most one without a name", check: instanceList, each: INSTANCE },
	timeoutSeconds: { about: "How long one call to YouTrack may take before it is given up", default: "30", check: seconds },
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	const { instances, timeoutSeconds } = options;
	if (timeoutSeconds !== undefined && seconds(timeoutSeconds) !== undefined) problems.push({ path: "timeoutSeconds", problem: `expected ${seconds(timeoutSeconds)}, got ${describe(timeoutSeconds)}` });
	if (!Array.isArray(instances) || instances.length === 0)
		return [...problems, { path: "instances", problem: `expected ${instanceList(instances)}, got ${Array.isArray(instances) ? "an empty list" : describe(instances)}` }];
	const names = new Map<unknown, number>();
	instances.forEach((instance: unknown, index) => {
		const at = `instances[${index}]`;
		if (typeof instance !== "object" || instance === null || Array.isArray(instance)) return problems.push({ path: at, problem: `expected an instance { name?, urlEnv, tokenEnv }, got ${describe(instance)}` });
		const record = instance as Readonly<Record<string, unknown>>;
		for (const key of Object.keys(record)) if (!Object.hasOwn(INSTANCE, key)) problems.push({ path: `${at}.${key}`, problem: `unknown key; keys: ${Object.keys(INSTANCE).join(", ")}` });
		for (const [key, entry] of Object.entries(INSTANCE)) {
			const expected = key === "name" && record.name === undefined ? undefined : entry.check(record[key]);
			if (expected !== undefined) problems.push({ path: `${at}.${key}`, problem: `expected ${expected}, got ${describe(record[key])}` });
		}
		const first = names.get(record.name);
		if (first === undefined) names.set(record.name, index);
		else if (record.name === undefined) problems.push({ path: at, problem: `instances[${first}] has no name either; at most one instance is unnamed` });
		else problems.push({ path: `${at}.name`, problem: `${String(record.name)} is the name of instances[${first}] too` });
	});
	return problems;
}

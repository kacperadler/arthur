import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The github plugin's options file (spec/roadmap.md, entries 57, 58 and 93), checked before any setup by walking `table`:
// docs/github.md, "Options". The tokens' values, and which instance each project with a `ci.workflow` uses, are checked at setup.

export type InstanceOptions = { readonly name?: string; readonly tokenEnv: string; readonly apiUrl?: string };
export type Wake = "ci-finished" | "pull-request-review";
export type GithubOptions = { readonly enabled?: boolean; readonly instances: readonly InstanceOptions[]; readonly poll?: { readonly everySeconds?: number }; readonly wakeOn?: readonly Wake[] };

export const summary = "GitHub accounts, named and unnamed: CI runs polled, ci-finished once per run attempt, arthur ci and --rerun, branches pushed, pull request reviews";

export const tools: readonly Tool[] = [];

export const EVERY_SECONDS = 120;
export const WAKES: readonly Wake[] = ["ci-finished", "pull-request-review"];
export const WAKE_ON: readonly Wake[] = ["ci-finished"];
export const API_URL = "https://api.github.com";

const INSTANCE: Readonly<Record<string, ValueOption>> = {
	name: {
		about: "The instance's name, the owner (user or organization) of the repositories it reads",
		default: "none: the unnamed instance, for every other owner",
		check: (value) => (typeof value === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ? undefined : "a GitHub owner in lowercase: letters, digits and single dashes"),
	},
	tokenEnv: { about: "The variable holding a token that reads Actions of the owner's repositories", check: (value) => (typeof value === "string" && value !== "" ? undefined : "the name of an env variable") },
	apiUrl: {
		about: "The REST API's address; GitHub Enterprise Server's is https://<host>/api/v3",
		default: API_URL,
		check: (value) => (typeof value === "string" && URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol) ? undefined : "an http or https URL"),
	},
};
const instanceList: Check = (value) => (Array.isArray(value) && value.length > 0 ? undefined : "a list of at least one instance");
const every: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of seconds, 1 or more");
const wakes: Check = (value) =>
	Array.isArray(value) && value.every((each) => WAKES.includes(each)) && new Set(value).size === value.length ? undefined : `a list of distinct events among ${WAKES.join(", ")}`;

export const table: OptionTable = {
	instances: { about: "The GitHub accounts, each { name?, tokenEnv, apiUrl? }; at most one without a name", check: instanceList, each: INSTANCE },
	poll: { about: "How often the CI runs are asked for", fields: { everySeconds: { about: "Seconds between two polls; each asks GitHub once per project with a ci.workflow", default: String(EVERY_SECONDS), check: every } } },
	wakeOn: {
		about: "The events that wake the coordinator; pull-request-review also turns on the polling of pull request reviews",
		default: WAKE_ON.join(", "),
		check: wakes,
	},
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	const { instances, poll, wakeOn } = options;
	if (wakeOn !== undefined && wakes(wakeOn) !== undefined) problems.push({ path: "wakeOn", problem: `expected ${wakes(wakeOn)}, got ${describe(wakeOn)}` });
	if (poll !== undefined) {
		if (typeof poll !== "object" || poll === null || Array.isArray(poll)) problems.push({ path: "poll", problem: `expected { everySeconds }, got ${describe(poll)}` });
		else
			for (const [key, value] of Object.entries(poll)) {
				if (key !== "everySeconds") problems.push({ path: `poll.${key}`, problem: "unknown key; keys: everySeconds" });
				else if (every(value) !== undefined) problems.push({ path: "poll.everySeconds", problem: `expected ${every(value)}, got ${describe(value)}` });
			}
	}
	if (!Array.isArray(instances) || instances.length === 0)
		return [...problems, { path: "instances", problem: `expected ${instanceList(instances)}, got ${Array.isArray(instances) ? "an empty list" : describe(instances)}` }];
	const names = new Map<unknown, number>();
	instances.forEach((instance: unknown, index) => {
		const at = `instances[${index}]`;
		if (typeof instance !== "object" || instance === null || Array.isArray(instance)) return problems.push({ path: at, problem: `expected an instance { name?, tokenEnv, apiUrl? }, got ${describe(instance)}` });
		const record = instance as Readonly<Record<string, unknown>>;
		for (const key of Object.keys(record)) if (!Object.hasOwn(INSTANCE, key)) problems.push({ path: `${at}.${key}`, problem: `unknown key; keys: ${Object.keys(INSTANCE).join(", ")}` });
		for (const [key, entry] of Object.entries(INSTANCE)) {
			const expected = key !== "tokenEnv" && record[key] === undefined ? undefined : entry.check(record[key]);
			if (expected !== undefined) problems.push({ path: `${at}.${key}`, problem: `expected ${expected}, got ${describe(record[key])}` });
		}
		const first = names.get(record.name);
		if (first === undefined) names.set(record.name, index);
		else if (record.name === undefined) problems.push({ path: at, problem: `instances[${first}] has no name either; at most one instance is unnamed` });
		else problems.push({ path: `${at}.name`, problem: `${String(record.name)} is the name of instances[${first}] too` });
	});
	return problems;
}

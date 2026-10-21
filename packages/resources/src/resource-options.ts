import { totalmem } from "node:os";
import { describe, type LoadedConfig, memoryBytes } from "@arthur/core";
import type { OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The resources plugin's options file (spec/roadmap.md, entries 32 to 34, 69 and 93), checked before any setup by walking `table`:
// docs/resources.md. A percentage of memory is of this host's.

export const summary = "each job's CPU and memory, the caps of all jobs of one ticket, and how many jobs each machine has room for";

export const tools: readonly Tool[] = [];

type Fields = Readonly<Record<string, ValueOption>>;

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);
const capNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? undefined : "a number of 0 or more, 0 for no cap");

const PER_JOB: Fields = {
	cpu: {
		about: "A job's cores, which it reserves on its machine; over them it is slowed. At most core.jobs.cpu",
		default: "no cap",
		check: (value) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? undefined : "a number of cores above 0"),
	},
	memory: {
		about: "A job's memory as systemd's MemoryMax, which it reserves on its machine; over it the job ends. At most core.jobs.memory",
		default: "no cap",
		check: (value) => (typeof value === "string" && memoryBytes(value, totalmem()) !== undefined ? undefined : 'systemd MemoryMax syntax such as "4G", "25%" or "infinity"'),
	},
};

// Also the keys of a ticket's own `caps` (feature-caps.ts).
export const CAPS = {
	budgetUsd: { about: "USD the costs of its jobs may sum to; a spawn at it is refused, a running job stopped and blocked", default: "no cap", check: capNumber },
	hours: { about: "Hours its jobs may run, summed; a spawn at it is refused, a running job stopped and blocked", default: "no cap", check: capNumber },
	cpu: { about: "The cores of the ticket's own slice inside the jobs' slice", default: "no cap", check: capNumber },
	memory: {
		about: "The memory of the ticket's own slice, as systemd's MemoryMax",
		default: "no cap",
		check: (value: unknown) => (value === 0 || (typeof value === "string" && memoryBytes(value, totalmem()) !== undefined) ? undefined : 'systemd MemoryMax syntax such as "8G", "25%" or "infinity", or 0 for no cap'),
	},
} as const satisfies Fields;

const KEEP_FREE: Fields = {
	cpu: { about: "Cores left free", default: "0", check: (value) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? undefined : "a number of cores, 0 or more") },
	memory: {
		about: "Memory left free: bytes with K, M, G or T, or a percentage of the machine's memory",
		default: "none",
		check: (value) =>
			value !== "infinity" && typeof value === "string" && memoryBytes(value, totalmem()) !== undefined ? undefined : 'bytes with K, M, G or T ("2G") or a percentage of the machine\'s memory ("10%")',
	},
	disk: {
		about: "Disk left free on each filesystem a machine's jobs write, its home and each path a plugin names: bytes with K, M, G or T; under it no job starts there",
		default: "0",
		check: (value) => (value === 0 || (typeof value === "string" && value !== "infinity" && !value.endsWith("%") && memoryBytes(value, 0) !== undefined) ? undefined : 'bytes with K, M, G or T ("20G"), or 0 for no floor'),
	},
};

export const table: OptionTable = {
	perJob: { about: "Each job's own CPU and memory caps on its scope, which it also reserves on its machine", fields: PER_JOB },
	perFeature: { about: "The caps of all jobs of one ticket together, each replaced by the ticket's own caps; 0: no cap", fields: CAPS },
	keepFree: { about: "Left free on every machine for the coordinator and the system: a job starts only while its machine keeps these", fields: KEEP_FREE },
};

// `perJob`'s caps, each refused above the joint limit of all jobs together, as this host's config sets it: one job cannot have
// more than all of them.
export function checkOptions(options: Options, core: LoadedConfig["core"]): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	if (options.perFeature !== undefined) problems.push(...capsProblems(options.perFeature, "perFeature"));
	if (options.keepFree !== undefined) problems.push(...walk(options.keepFree, KEEP_FREE, "keepFree"));
	if (options.perJob === undefined) return problems;
	const above = (key: string, value: unknown) => {
		if (key === "cpu" && (value as number) > core.jobs.cpu) return `${value} is above core.jobs.cpu, ${core.jobs.cpu}, the cores of all jobs together`;
		const limit = memoryBytes(core.jobs.memory, totalmem()) ?? Infinity;
		if (key === "memory" && (memoryBytes(value as string, totalmem()) as number) > limit) return `${value} is above core.jobs.memory, ${core.jobs.memory}, the memory of all jobs together`;
		return undefined;
	};
	return [...problems, ...walk(options.perJob, PER_JOB, "perJob", above)];
}

// `value` as an object of `fields`: each unknown key, then each key given, in the table's order, checked; `more` says what else
// is wrong with a value its check passes.
function walk(value: unknown, fields: Fields, at: string, more: (key: string, value: unknown) => string | undefined = () => undefined): OptionProblem[] {
	const keys = Object.keys(fields).join(", ");
	if (!isObject(value)) return [{ path: at, problem: `expected an object with ${keys}, got ${describe(value)}` }];
	const problems = Object.keys(value)
		.filter((key) => !Object.hasOwn(fields, key))
		.map((key) => ({ path: `${at}.${key}`, problem: `unknown key; keys: ${keys}` }));
	for (const [key, entry] of Object.entries(fields)) {
		const given = value[key];
		const expected = given === undefined ? undefined : entry.check(given);
		const problem = expected === undefined ? given === undefined ? undefined : more(key, given) : `expected ${expected}, got ${describe(given)}`;
		if (problem !== undefined) problems.push({ path: `${at}.${key}`, problem });
	}
	return problems;
}

// The problems of `value` as caps, each path under `at`: `perFeature` in the options, `caps` in a ticket; in the order given.
export function capsProblems(value: unknown, at: string): OptionProblem[] {
	const keys = Object.keys(CAPS).join(", ");
	if (!isObject(value)) return [{ path: at, problem: `expected an object with ${keys}, got ${describe(value)}` }];
	return Object.entries(value).flatMap(([key, each]): OptionProblem[] => {
		const path = `${at}.${key}`;
		const entry: ValueOption | undefined = Object.hasOwn(CAPS, key) ? CAPS[key as keyof typeof CAPS] : undefined;
		if (entry === undefined) return [{ path, problem: `unknown key; keys: ${keys}` }];
		const expected = entry.check(each);
		return expected === undefined ? [] : [{ path, problem: `expected ${expected}, got ${describe(each)}` }];
	});
}

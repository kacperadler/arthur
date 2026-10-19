import { isAbsolute } from "node:path";
import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The machines plugin's options file (spec/roadmap.md, entries 30 and 93), checked before any setup by walking `table`:
// docs/commands/machines.md, "The list". A name and an ssh the core's `registerMachine` would refuse are refused here first,
// with the option's path.

export type Labels = { readonly os?: string; readonly arch?: string; readonly tools?: readonly string[] };
export type MachineEntry = { readonly name: string; readonly ssh: string; readonly home: string; readonly labels?: Labels; readonly maxJobs?: number };
export type MachinesOptions = {
	readonly enabled?: boolean;
	// `local` is the machine Arthur runs on: its os and arch are detected, its tools and maxJobs given here.
	readonly local?: { readonly labels?: { readonly tools?: readonly string[] }; readonly maxJobs?: number };
	readonly list?: readonly MachineEntry[];
	readonly check?: { readonly everySeconds?: number };
};

export const summary = "the other machines jobs run on, their labels and SSH checks, and placing each job by labels";

export const tools: readonly Tool[] = [];

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// Never an ssh option: no leading dash, no space.
const HOST = /^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/;
const text: Check = (value) => (typeof value === "string" && value.trim() !== "" ? undefined : "a non-empty string");
const count: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of 1 or more");
const detected: Check = () => "nothing: the os and arch of local are detected";
const machineList: Check = (value) => (Array.isArray(value) ? undefined : "a list of machines");
const TOOLS = {
	about: "The tools on it that a job may need, such as docker",
	check: (value: unknown) => (Array.isArray(value) && value.every((tool) => text(tool) === undefined) ? undefined : "a list of non-empty strings"),
};
const MAX_JOBS = { about: "The most jobs at once on it", default: "no limit of its own; orchestration's maxAgents counts every job", check: count };
const LABELS: OptionTable = {
	os: { about: 'Its os, "linux" or "macos"; one that disagrees with the machine keeps it offline', check: (value) => (value === "linux" || value === "macos" ? undefined : '"linux" or "macos"') },
	arch: { about: "Its arch in Node's word (x64, arm64); one that disagrees with the machine keeps it offline", check: text },
	tools: TOOLS,
};
const FIELDS: OptionTable = {
	name: { about: "The machine's name, which --machine and a job's record use; never local", check: (value) => (typeof value === "string" && NAME.test(value) ? undefined : "lowercase letters, digits and dashes, from a letter") },
	ssh: { about: "A Host of ~/.ssh/config, or a host name such as a Tailscale name", check: (value) => (typeof value === "string" && HOST.test(value) ? undefined : "a Host of ~/.ssh/config or a host name (letters, digits, _ . @ -), never an ssh option") },
	home: { about: "Arthur's home folder there, for its jobs and repositories", check: (value) => (typeof value === "string" && isAbsolute(value) ? undefined : "an absolute path, Arthur's home folder there") },
	labels: { about: "What a project's or a ticket's requires is matched against", fields: LABELS },
	maxJobs: MAX_JOBS,
};
const LOCAL_LABELS: OptionTable = { os: { about: "Detected, never set", check: detected }, arch: { about: "Detected, never set", check: detected }, tools: TOOLS };
const LOCAL: OptionTable = { labels: { about: "Its labels: its os and arch are detected, its tools given here", fields: LOCAL_LABELS }, maxJobs: MAX_JOBS };
const EVERY: OptionTable = {
	everySeconds: {
		about: "Seconds between the checks of every machine over ssh: its address private, arthur version, its os and arch, its free CPU and memory",
		default: "60",
		check: (value) => (Number.isInteger(value) && (value as number) >= 10 ? undefined : "a whole number of seconds, 10 or more, as a check may take 10 s"),
	},
};

export const table: OptionTable = {
	local: { about: "The machine Arthur and the coordinator run on", fields: LOCAL },
	list: { about: "The other machines, reached with ssh over a private network with the user's own keys", check: machineList, each: FIELDS },
	check: { about: "The checks of every machine, at start and then this often", fields: EVERY },
};

// `value` as an object of `table`'s keys, each value checked: one problem per unknown key or wrong value, at `<at>.<key>`. A
// nested object, and a list of objects, the caller walks on its own.
function walk(value: unknown, table: OptionTable, at: string, who: string, problems: OptionProblem[]): Readonly<Record<string, unknown>> | undefined {
	const [path, said] = [(key: string) => (at === "" ? key : `${at}.${key}`), (problem: string) => (who === "" ? problem : `${who}: ${problem}`)];
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		problems.push({ path: at, problem: said(`expected an object of ${Object.keys(table).join(", ")}, got ${describe(value)}`) });
		return undefined;
	}
	const record = value as Readonly<Record<string, unknown>>;
	for (const [key, item] of Object.entries(record)) {
		const entry = Object.hasOwn(table, key) ? table[key] : undefined;
		if (entry === undefined) problems.push({ path: path(key), problem: said(`unknown key; keys: ${Object.keys(table).join(", ")}`) });
		const expected = item === undefined || entry === undefined || "fields" in entry || entry.each !== undefined ? undefined : entry.check(item);
		if (expected !== undefined) problems.push({ path: path(key), problem: said(`expected ${expected}, got ${describe(item)}`) });
	}
	return record;
}

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = [];
	walk(options, table, "", "", problems);
	const { local, list, check } = options;
	if (local !== undefined) {
		const labels = walk(local, LOCAL, "local", "machine local", problems)?.labels;
		if (labels !== undefined) walk(labels, LOCAL_LABELS, "local.labels", "machine local", problems);
	}
	if (check !== undefined) walk(check, EVERY, "check", "", problems);
	if (list === undefined) return problems;
	if (!Array.isArray(list)) return [...problems, { path: "list", problem: `expected ${machineList(list)}, got ${describe(list)}` }];
	const first = new Map<string, string>();
	list.forEach((entry: unknown, index) => {
		const at = `list[${index}]`;
		const name = (entry as { readonly name?: unknown } | null)?.name;
		const who = typeof name === "string" ? `machine ${name}` : "a machine without a name";
		const machine = walk(entry, FIELDS, at, who, problems);
		if (machine === undefined) return;
		for (const key of ["name", "ssh", "home"]) if (machine[key] === undefined) problems.push({ path: `${at}.${key}`, problem: `${who}: ${key} is required` });
		if (machine.labels !== undefined) walk(machine.labels, LABELS, `${at}.labels`, who, problems);
		if (typeof name !== "string") return;
		if (name === "local") problems.push({ path: `${at}.name`, problem: "machine local: local is the machine Arthur runs on; its tools and maxJobs go in the local option" });
		else if (first.has(name)) problems.push({ path: `${at}.name`, problem: `${who}: two machines named ${name}, ${first.get(name)} and ${at}` });
		else first.set(name, at);
	});
	return problems;
}

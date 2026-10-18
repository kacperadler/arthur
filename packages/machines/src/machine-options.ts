import { isAbsolute } from "node:path";
import { describe } from "@arthur/core";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The machines plugin's options (spec/roadmap.md, entry 30), checked before any setup: docs/commands/machines.md, "The list".
// A name and an ssh the core's `registerMachine` would refuse are refused here first, with the option's path.

export type Labels = { readonly os?: string; readonly arch?: string; readonly tools?: readonly string[] };
export type MachineEntry = { readonly name: string; readonly ssh: string; readonly home: string; readonly labels?: Labels; readonly maxJobs?: number };
export type MachinesOptions = {
	readonly enabled?: boolean;
	// `local` is the machine Arthur runs on: its os and arch are detected, its tools and maxJobs given here.
	readonly local?: { readonly labels?: { readonly tools?: readonly string[] }; readonly maxJobs?: number };
	readonly list?: readonly MachineEntry[];
	readonly check?: { readonly everySeconds?: number };
};

// What a value should be, or undefined when it is.
type Check = (value: unknown) => string | undefined;

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// Never an ssh option: no leading dash, no space.
const HOST = /^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/;
const pass: Check = () => undefined;
const text: Check = (value) => (typeof value === "string" && value.trim() !== "" ? undefined : "a non-empty string");
const tools: Check = (value) => (Array.isArray(value) && value.every((tool) => text(tool) === undefined) ? undefined : "a list of non-empty strings");
const count: Check = (value) => (Number.isInteger(value) && (value as number) >= 1 ? undefined : "a whole number of 1 or more");
const detected: Check = () => "nothing: the os and arch of local are detected";
const LABELS = { os: (value: unknown) => (value === "linux" || value === "macos" ? undefined : '"linux" or "macos"'), arch: text, tools };
const FIELDS = {
	name: (value: unknown) => (typeof value === "string" && NAME.test(value) ? undefined : "lowercase letters, digits and dashes, from a letter"),
	ssh: (value: unknown) => (typeof value === "string" && HOST.test(value) ? undefined : "a Host of ~/.ssh/config or a host name (letters, digits, _ . @ -), never an ssh option"),
	home: (value: unknown) => (typeof value === "string" && isAbsolute(value) ? undefined : "an absolute path, Arthur's home folder there"),
	labels: pass,
	maxJobs: count,
};

// `value` as an object of `table`'s keys, each checked: one problem per unknown key or wrong value, at `<at>.<key>`.
function walk(value: unknown, table: Readonly<Record<string, Check>>, at: string, who: string, problems: OptionProblem[]): Readonly<Record<string, unknown>> | undefined {
	const [path, said] = [(key: string) => (at === "" ? key : `${at}.${key}`), (problem: string) => (who === "" ? problem : `${who}: ${problem}`)];
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		problems.push({ path: at, problem: said(`expected an object of ${Object.keys(table).join(", ")}, got ${describe(value)}`) });
		return undefined;
	}
	const record = value as Readonly<Record<string, unknown>>;
	for (const [key, item] of Object.entries(record)) {
		const check = Object.hasOwn(table, key) ? table[key] : undefined;
		if (check === undefined) problems.push({ path: path(key), problem: said(`unknown key; keys: ${Object.keys(table).join(", ")}`) });
		const expected = item === undefined ? undefined : check?.(item);
		if (expected !== undefined) problems.push({ path: path(key), problem: said(`expected ${expected}, got ${describe(item)}`) });
	}
	return record;
}

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = [];
	walk(options, { local: pass, list: pass, check: pass }, "", "", problems);
	const { local, list, check } = options;
	if (local !== undefined) {
		const labels = walk(local, { labels: pass, maxJobs: count }, "local", "machine local", problems)?.labels;
		if (labels !== undefined) walk(labels, { os: detected, arch: detected, tools }, "local.labels", "machine local", problems);
	}
	if (check !== undefined) {
		const everySeconds = (value: unknown) => (Number.isInteger(value) && (value as number) >= 10 ? undefined : "a whole number of seconds, 10 or more, as a check may take 10 s");
		walk(check, { everySeconds }, "check", "", problems);
	}
	if (list === undefined) return problems;
	if (!Array.isArray(list)) return [...problems, { path: "list", problem: `expected a list of machines, got ${describe(list)}` }];
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

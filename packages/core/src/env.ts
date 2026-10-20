import { readFileSync } from "node:fs";
import type { LoadedConfig } from "./config.ts";
import { asPlugin } from "./plugin-host.ts";

// The `...Env` options of the enabled plugins, their names and values: docs/commands/config.md. No value enters any output.

export type Shell = Readonly<Record<string, string | undefined>>;

// `option` is the option's path from the plugin's name, e.g. `youtrack.instances[1].tokenEnv`.
export type EnvVariable = { readonly plugin: string; readonly option: string; readonly name: string; readonly set: boolean };

export type EnvCheck = {
	readonly variables: readonly EnvVariable[];
	// Per plugin, its set variables by name. A shell variable wins even when empty.
	readonly values: Readonly<Record<string, Readonly<Record<string, string>>>>;
	readonly problems: readonly string[];
	readonly warnings: readonly string[];
	readonly envFileFound: boolean;
};

type Found = { readonly option: string; readonly name: unknown; readonly instance: string | undefined };
type Owner = { readonly prefix: string; readonly owner: string };

const VARIABLE = /^[A-Z][A-Z0-9_]*$/;
const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Refuses the start: every problem and every missing variable, one line each, naming the option and the variable.
export function resolveEnv(config: LoadedConfig, shell: Shell = process.env): Pick<EnvCheck, "values" | "warnings"> {
	const check = checkEnv(config, shell);
	const where = `${config.core.envFile}${check.envFileFound ? "" : ", which does not exist"}`;
	const missing = check.variables
		.filter((variable) => !variable.set)
		.map((variable) => `${config.path}: ${variable.option}: ${variable.name} is missing: not in the shell nor in ${where}`);
	const problems = [...check.problems, ...missing];
	if (problems.length > 0) throw new Error(problems.join("\n"));
	return { values: check.values, warnings: check.warnings };
}

// An entry of the plugin list that the host refuses (`checkPlugins`) is skipped: its refusal is the host's. So is a second plugin of a name.
export function checkEnv(config: LoadedConfig, shell: Shell = process.env): EnvCheck {
	const problems: string[] = [];
	const plugins = config.plugins
		.map(asPlugin)
		.filter((plugin) => typeof plugin !== "string")
		.filter((plugin, index, all) => all.findIndex((other) => other.name === plugin.name) === index);
	const file = readEnvFile(config.core.envFile);
	problems.push(...file.problems);
	const enabled = plugins.filter((plugin) => plugin.options?.enabled !== false).map((plugin) => ({ plugin, found: [] as Found[] }));
	for (const { plugin, found } of enabled) findEnv(plugin.options, "", undefined, found);
	// Every prefix someone owns, across plugins: the longest one a name starts with is its one owner, so none may be owned twice.
	const owners: Owner[] = plugins.map((plugin) => ({ prefix: prefix(plugin.name), owner: `plugin ${plugin.name}` }));
	for (const { plugin, found } of enabled)
		for (const instance of new Set(found.flatMap((entry) => (entry.instance === undefined ? [] : [entry.instance]))))
			owners.push({ prefix: prefix(plugin.name) + part(instance), owner: `instance ${instance} of plugin ${plugin.name}` });
	owners.forEach((entry, index) => {
		const first = owners.slice(0, index).find((other) => other.prefix === entry.prefix);
		if (first) problems.push(`${config.path}: ${entry.prefix} is the prefix of both ${first.owner} and ${entry.owner}`);
	});
	const variables: EnvVariable[] = [];
	const values: Record<string, Record<string, string>> = {};
	for (const { plugin, found } of enabled) {
		const own = prefix(plugin.name);
		const set: Record<string, string> = {};
		for (const { option, name, instance } of found) {
			const path = `${plugin.name}.${option}`;
			const problem = nameProblem(name, instance === undefined ? own : own + part(instance), owners);
			if (problem !== undefined || typeof name !== "string") {
				problems.push(`${config.path}: ${path}: ${problem}`);
				continue;
			}
			const value = shell[name] ?? file.values.get(name);
			variables.push({ plugin: plugin.name, option: path, name, set: value !== undefined });
			if (value !== undefined) set[name] = value;
		}
		values[plugin.name] = set;
	}
	return { variables, values, problems, warnings: file.warnings, envFileFound: file.found };
}

// Every option ending in `Env`, at any depth; an object with a string `name` is a named instance.
function findEnv(value: unknown, path: string, instance: string | undefined, found: Found[]): void {
	if (Array.isArray(value)) {
		value.forEach((item, index) => findEnv(item, `${path}[${index}]`, instance, found));
		return;
	}
	if (typeof value !== "object" || value === null) return;
	const record = value as Readonly<Record<string, unknown>>;
	const named = typeof record.name === "string" ? record.name : instance;
	for (const [key, field] of Object.entries(record)) {
		const at = path ? `${path}.${key}` : key;
		if (!key.endsWith("Env")) findEnv(field, at, named, found);
		else if (field !== undefined) found.push({ option: at, name: field, instance: named });
	}
}

// The name must be the option's own prefix and a non-empty rest, and not inside a longer prefix someone else owns;
// the longest such prefix names its owner, whatever order the owners come in.
function nameProblem(name: unknown, own: string, taken: readonly Owner[]): string | undefined {
	const expected = `expected ${own}<WHAT>`;
	if (typeof name !== "string") return `${expected}, got ${kind(name)}`;
	// Not shown: a text that is no variable name may be the secret itself, pasted by mistake.
	if (!VARIABLE.test(name)) return `${expected} (capitals, digits and _); the text given is not shown`;
	if (!name.startsWith(own) || name.length === own.length) return `${expected}, got ${name}`;
	let other: Owner | undefined;
	for (const entry of taken) if (entry.prefix.length > (other?.prefix ?? own).length && name.startsWith(entry.prefix)) other = entry;
	if (other) return `${expected}, got ${name}, a name of ${other.owner}`;
	return undefined;
}

function prefix(plugin: string): string {
	return `ARTHUR_${plugin.toUpperCase().replaceAll("-", "_")}_`;
}

function part(instance: string): string {
	return `${instance.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_`;
}

function kind(value: unknown): string {
	if (value === undefined) return "nothing";
	if (value === null) return "null";
	if (Array.isArray(value)) return "a list";
	return typeof value === "object" ? "an object" : `a ${typeof value}`;
}

type EnvFile = { readonly values: ReadonlyMap<string, string>; readonly problems: string[]; readonly warnings: string[]; readonly found: boolean };

function readEnvFile(path: string): EnvFile {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		const problems = code === "ENOENT" ? [] : [`${path}: cannot be read (${code ?? "unknown error"})`];
		return { values: new Map(), problems, warnings: [], found: false };
	}
	return { ...parseEnvFile(text, path), found: true };
}

// `KEY=value` lines, `#` comments and blank lines; a value may sit in single or double quotes, taken as written.
// A line is named by its number only, never shown: it may hold a secret.
export function parseEnvFile(text: string, file: string): Omit<EnvFile, "found"> {
	const values = new Map<string, string>();
	const seen = new Map<string, number[]>();
	const problems: string[] = [];
	text.split(/\r?\n/).forEach((raw, index) => {
		const line = raw.trim();
		if (line === "" || line.startsWith("#")) return;
		const at = `${file}:${index + 1}`;
		const equals = line.indexOf("=");
		const key = line.slice(0, Math.max(equals, 0)).trim();
		if (equals === -1 || !KEY.test(key)) {
			problems.push(`${at}: expected KEY=value, the key letters, digits and _; the line is not shown`);
			return;
		}
		const value = unquote(line.slice(equals + 1).trim());
		if (value === undefined) {
			problems.push(`${at}: ${key}: expected a value in matching quotes, then nothing or a # comment; the value is not shown`);
			return;
		}
		values.set(key, value);
		seen.set(key, [...(seen.get(key) ?? []), index + 1]);
	});
	const warnings = [...seen]
		.filter(([, lines]) => lines.length > 1)
		.map(([key, lines]) => `${file}: ${key} is set on lines ${lines.join(", ")}; the last wins`);
	return { values, problems, warnings };
}

function unquote(text: string): string | undefined {
	const quote = text[0];
	if (quote !== '"' && quote !== "'") {
		const comment = text.search(/\s#/);
		return comment === -1 ? text : text.slice(0, comment).trim();
	}
	const end = text.indexOf(quote, 1);
	if (end === -1) return undefined;
	const rest = text.slice(end + 1).trim();
	return rest === "" || rest.startsWith("#") ? text.slice(1, end) : undefined;
}

import { resolve } from "node:path";
import { describe } from "@arthur/core";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The projects plugin's options (spec/roadmap.md, entry 41), checked before any setup: docs/commands/projects.md, "The list".
// A key a later plugin reads (`tracker`, `ci`, `commitRules`, `autoMerge`, `requires`, `docker`) is checked for its shape
// only; whether its value makes sense is that plugin's to say.

type Check = (value: unknown) => string | undefined;

const NAME = /^[a-z0-9][a-z0-9.-]*$/;
const PREFIX = /^[A-Z]+$/;

const text: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "a non-empty string");
const line =
	(max: number): Check =>
	(value) =>
		typeof value === "string" && value.trim() !== "" && value.length <= max && !/[\r\n]/.test(value) ? undefined : `one line of 1 to ${max} characters`;
const flag: Check = (value) => (typeof value === "boolean" ? undefined : "true or false");
// An object of exactly these keys, `required` among them, each passing its check; else `form`.
const object =
	(fields: Readonly<Record<string, Check>>, required: readonly string[], form: string): Check =>
	(value) => {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return form;
		const record = value as Readonly<Record<string, unknown>>;
		const keys = Object.keys(record);
		const wrong = keys.some((key) => !Object.hasOwn(fields, key) || fields[key]?.(record[key]) !== undefined);
		return wrong || required.some((key) => record[key] === undefined) ? form : undefined;
	};
const rules = object({ regex: text, words: text, file: text }, [], "exactly one of { regex }, { words }, { file }, a non-empty string");

const FIELDS: Readonly<Record<string, Check>> = {
	name: (value) => (typeof value === "string" && NAME.test(value) ? undefined : "lowercase letters, digits, dots and dashes, from a letter or digit"),
	prefix: (value) => (typeof value === "string" && PREFIX.test(value) ? undefined : "capital letters A-Z"),
	path: text,
	repo: text,
	title: line(60),
	about: line(300),
	install: (value) => (typeof value === "string" ? undefined : 'a shell command, or "" for none'),
	tracker: object({ plugin: text, instance: text, project: text }, ["plugin", "project"], "{ plugin, instance?, project }, each a non-empty string"),
	ci: object({ workflow: text }, ["workflow"], "{ workflow }, a non-empty string"),
	commitRules: (value) => rules(value) ?? (Object.keys(value as object).length === 1 ? undefined : rules(undefined)),
	autoMerge: flag,
	requires: object(
		{ os: text, arch: text, tools: (value) => (Array.isArray(value) && value.every((tool) => text(tool) === undefined) ? undefined : "a list") },
		[],
		"{ os?, arch?, tools? }: os and arch non-empty strings, tools a list of them",
	),
	docker: flag,
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = [];
	for (const key of Object.keys(options)) if (key !== "list" && key !== "reposDir") problems.push({ path: key, problem: "unknown option; options: list, reposDir" });
	const { list, reposDir } = options;
	if (reposDir !== undefined && text(reposDir) !== undefined) problems.push({ path: "reposDir", problem: `expected a folder, got ${describe(reposDir)}` });
	if (!Array.isArray(list) || list.length === 0)
		return [...problems, { path: "list", problem: `expected a list of at least one project, got ${Array.isArray(list) ? "an empty list" : describe(list)}` }];
	// Each word a project is known by, lowercased, and whose it is; each project's folder, and whose it is.
	const words = new Map<string, string>();
	const folders = new Map<string, string>();
	list.forEach((entry: unknown, index) => {
		const at = `list[${index}]`;
		if (typeof entry !== "object" || entry === null || Array.isArray(entry))
			return problems.push({ path: at, problem: `expected a project { name, prefix, path or repo, ... }, got ${describe(entry)}` });
		const project = entry as Readonly<Record<string, unknown>>;
		const who = typeof project.name === "string" ? `project ${project.name}` : "a project without a name";
		const refuse = (key: string, problem: string) => problems.push({ path: key === "" ? at : `${at}.${key}`, problem: `${who}: ${problem}` });
		for (const [key, value] of Object.entries(project)) {
			const check = Object.hasOwn(FIELDS, key) ? FIELDS[key] : undefined;
			const expected = check === undefined ? `unknown key; keys: ${Object.keys(FIELDS).join(", ")}` : value === undefined ? undefined : check(value);
			if (expected !== undefined) refuse(key, check === undefined ? expected : `expected ${expected}, got ${describe(value)}`);
		}
		for (const key of ["name", "prefix"]) if (project[key] === undefined) refuse(key, `${key} is required`);
		if ((project.path === undefined) === (project.repo === undefined)) refuse("", "expected exactly one of path and repo");
		if (project.repo !== undefined && reposDir === undefined) refuse("repo", "a repo is cloned into reposDir, which is not set");
		const own = new Map<string, string>();
		for (const key of ["name", "prefix", "title"]) {
			const value = project[key] ?? (key === "title" ? project.name : undefined);
			if (typeof value === "string" && !own.has(value.toLowerCase())) own.set(value.toLowerCase(), key);
		}
		for (const [word, key] of own) {
			const first = words.get(word);
			if (first !== undefined) refuse(key, `its ${key} "${word}" is ${first}; names, prefixes and titles are compared without case`);
			else words.set(word, `the ${key} of ${who}`);
		}
		const folder = typeof project.path === "string" ? resolve(project.path) : typeof reposDir === "string" && typeof project.name === "string" ? resolve(reposDir, project.name) : undefined;
		if (folder === undefined) return;
		const first = folders.get(folder);
		if (first !== undefined) refuse("", `its folder ${folder} is the folder of ${first}`);
		else folders.set(folder, who);
	});
	return problems;
}

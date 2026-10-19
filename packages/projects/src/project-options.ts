import { isAbsolute, normalize, resolve, sep } from "node:path";
import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The projects plugin's options file (spec/roadmap.md, entries 41 and 93), checked before any setup by walking `table`:
// docs/commands/projects.md, "The list". A key a later plugin reads (`tracker`, `ci`, `commitRules`, `autoMerge`, `requires`,
// `docker`) is checked for its shape only; whether its value makes sense is that plugin's to say.

export const summary = "the project list, each project's folder or clone, and each new worktree's install";

export const tools: readonly Tool[] = [];

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
// A file the core's prompt loader reads in the project's repository; one outside it is never read.
const inside: Check = (value) => (typeof value === "string" && value !== "" && !isAbsolute(value) && normalize(value).split(sep)[0] !== ".." ? undefined : "a path");

// One project of `list`: name, prefix and one of path and repo are required (checkOptions).
const FIELDS: Readonly<Record<string, ValueOption>> = {
	name: { about: "The project's name: a clone's folder name and the word --project takes", check: (value) => (typeof value === "string" && NAME.test(value) ? undefined : "lowercase letters, digits, dots and dashes, from a letter or digit") },
	prefix: { about: "The prefix of the project's ticket ids", check: (value) => (typeof value === "string" && PREFIX.test(value) ? undefined : "capital letters A-Z") },
	path: { about: "Its repository's folder, with a .git; relative to the folder Arthur runs in", check: text },
	repo: { about: "A Git URL, cloned into reposDir/<name> at load when missing", check: text },
	title: { about: "The project's full name", default: "its name", check: line(60) },
	about: { about: "What the project is and what it is for, which the coordinator reads", check: line(300) },
	install: { about: 'The shell command that installs a new worktree\'s dependencies; "" for none', default: "the frozen install of its one known lockfile", check: (value) => (typeof value === "string" ? undefined : 'a shell command, or "" for none') },
	tracker: { about: "Its issue tracker, read by that plugin: { plugin, instance?, project }", check: object({ plugin: text, instance: text, project: text }, ["plugin", "project"], "{ plugin, instance?, project }, each a non-empty string") },
	ci: { about: "Its CI workflow, read by the github plugin: { workflow }", check: object({ workflow: text }, ["workflow"], "{ workflow }, a non-empty string") },
	commitRules: { about: "Its commit message rule, read by the commit-rules plugin: one of { regex }, { words }, { file }", check: (value) => rules(value) ?? (Object.keys(value as object).length === 1 ? undefined : rules(undefined)) },
	autoMerge: { about: "Whether a branch with a PASS review and green CI merges on its own, read by the delivery plugin", check: flag },
	requires: {
		about: "The machine labels its jobs need, which the machines plugin places them by: { os?, arch?, tools? }",
		check: object(
			{ os: text, arch: text, tools: (value) => (Array.isArray(value) && value.every((tool) => text(tool) === undefined) ? undefined : "a list") },
			[],
			"{ os?, arch?, tools? }: os and arch non-empty strings, tools a list of them",
		),
	},
	docker: { about: "Whether its jobs use Docker, read by the docker plugin", check: flag },
	prompts: {
		about: "Where the roles read the project's files, each a path inside its repository: { vision?, criteriaDir?, rolesDir? }",
		default: "spec/vision.md, .agents/arthur/criteria, .agents/arthur/roles",
		check: object({ vision: inside, criteriaDir: inside, rolesDir: inside }, [], "{ vision?, criteriaDir?, rolesDir? }, each a path inside the project's repository"),
	},
};

const projectList: Check = (value) => (Array.isArray(value) && value.length > 0 ? undefined : "a list of at least one project");
const folder: Check = (value) => (text(value) === undefined ? undefined : "a folder");

export const table: OptionTable = {
	list: { about: "The projects, the first the main one, which a command without --project acts on", check: projectList, each: FIELDS },
	reposDir: { about: "Where repo projects are cloned, outside Arthur's home folder; relative to the folder Arthur runs in", check: folder },
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = [];
	for (const key of Object.keys(options)) if (!Object.hasOwn(table, key)) problems.push({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` });
	const { list, reposDir } = options;
	if (reposDir !== undefined && folder(reposDir) !== undefined) problems.push({ path: "reposDir", problem: `expected ${folder(reposDir)}, got ${describe(reposDir)}` });
	if (!Array.isArray(list) || list.length === 0)
		return [...problems, { path: "list", problem: `expected ${projectList(list)}, got ${Array.isArray(list) ? "an empty list" : describe(list)}` }];
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
			const entry = Object.hasOwn(FIELDS, key) ? FIELDS[key] : undefined;
			const expected = entry === undefined ? `unknown key; keys: ${Object.keys(FIELDS).join(", ")}` : value === undefined ? undefined : entry.check(value);
			if (expected !== undefined) refuse(key, entry === undefined ? expected : `expected ${expected}, got ${describe(value)}`);
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

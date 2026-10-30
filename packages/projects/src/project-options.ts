import { basename, isAbsolute, normalize, resolve, sep } from "node:path";
import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The projects plugin's options file (spec/roadmap.md, entries 41 and 93), checked before any setup by walking `table`, and
// the check of each project's own piece, `projects.project(...)` in its project file: docs/commands/projects.md. Another
// plugin's piece in that file is that plugin's to check (its `piece`).

export const summary = "the project folders, each project's checkout or clone, each new worktree's install, and arthur init with the onboarding of a new repository";

export const tools: readonly Tool[] = [];

export const NAME = /^[a-z0-9][a-z0-9.-]*$/;
const PREFIX = /^[A-Z]+$/;

const text: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "a non-empty string");
const line =
	(max: number): Check =>
	(value) =>
		typeof value === "string" && value.trim() !== "" && value.length <= max && !/[\r\n]/.test(value) ? undefined : `one line of 1 to ${max} characters`;
// A file of the project folder the core's prompt loader reads; one outside it is never read.
const inside: Check = (value) => (typeof value === "string" && value !== "" && !isAbsolute(value) && normalize(value).split(sep)[0] !== ".." ? undefined : "a path");
const prompts: Check = (value) => {
	const form = "{ vision?, criteriaDir?, rolesDir? }, each a path inside the project's folder";
	if (typeof value !== "object" || value === null || Array.isArray(value)) return form;
	return Object.entries(value).some(([key, path]) => !["vision", "criteriaDir", "rolesDir"].includes(key) || inside(path) !== undefined) ? form : undefined;
};

// The keys of a project's `projects.project(...)`: prefix and one of path and repo are required (checkProjects); its name is its folder's.
export const PIECE: Readonly<Record<string, ValueOption>> = {
	prefix: { about: "The prefix of the project's ticket ids", check: (value) => (typeof value === "string" && PREFIX.test(value) ? undefined : "capital letters A-Z") },
	path: { about: "Its repository's folder, with a .git; relative to the project's folder", check: text },
	repo: { about: "A Git URL, cloned into reposDir/<name> at load when missing", check: text },
	title: { about: "The project's full name", default: "its name", check: line(60) },
	about: { about: "What the project is and what it is for, which the coordinator reads", check: line(300) },
	install: { about: 'The shell command that installs a new worktree\'s dependencies; "" for none', default: "the frozen install of its one known lockfile", check: (value) => (typeof value === "string" ? undefined : 'a shell command, or "" for none') },
	prompts: {
		about: "Where the roles read the project's files, each a path inside its project folder: { vision?, criteriaDir?, rolesDir? }",
		default: "spec/vision.md, .agents/arthur/criteria, .agents/arthur/roles, in its repository",
		check: prompts,
	},
};

const folderList: Check = (value) => (Array.isArray(value) && value.length > 0 && value.every((each) => text(each) === undefined) ? undefined : "a list of at least one folder, each a non-empty string");
const folder: Check = (value) => (text(value) === undefined ? undefined : "a folder");

export const table: OptionTable = {
	folders: { about: "The project folders, each holding its project.config.ts and named as the project; the first is the main one, which a command without --project acts on; relative to the folder Arthur runs in", check: folderList },
	reposDir: { about: "Where repo projects are cloned, outside Arthur's home folder; relative to the folder Arthur runs in", check: folder },
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = [];
	for (const key of Object.keys(options)) if (!Object.hasOwn(table, key)) problems.push({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` });
	const { folders, reposDir } = options;
	if (reposDir !== undefined && folder(reposDir) !== undefined) problems.push({ path: "reposDir", problem: `expected ${folder(reposDir)}, got ${describe(reposDir)}` });
	if (folderList(folders) !== undefined) return [...problems, { path: "folders", problem: `expected ${folderList(folders)}, got ${Array.isArray(folders) && folders.length === 0 ? "an empty list" : describe(folders)}` }];
	const names = new Map<string, number>();
	(folders as readonly string[]).forEach((each, index) => {
		const name = basename(resolve(each));
		const first = names.get(name);
		if (!NAME.test(name)) problems.push({ path: `folders[${index}]`, problem: `the folder's name ${JSON.stringify(name)} is the project's name: lowercase letters, digits, dots and dashes, from a letter or digit` });
		else if (first !== undefined) problems.push({ path: `folders[${index}]`, problem: `a second folder named ${name}, as folders[${first}]; the folder's name is the project's name` });
		else names.set(name, index);
	});
	return problems;
}

// One project as its file gives it: its name (its folder's), its file, its folder and its `projects.project(...)` value.
export type Written = { readonly name: string; readonly file: string; readonly folder: string; readonly piece: unknown };

// Each project's piece, then what no two projects may share: a name, prefix or title, without case, and a checkout. Each
// problem names the file: `<file>: projects.project(...)[.<key>]: <problem>`.
export function checkProjects(written: readonly Written[], reposDir: unknown): string[] {
	const problems: string[] = [];
	// Each word a project is known by, lowercased, and whose it is; each project's checkout, and whose it is.
	const words = new Map<string, string>();
	const checkouts = new Map<string, string>();
	for (const { name, file, folder, piece } of written) {
		const refuse = (key: string, problem: string) => problems.push(`${file}: projects.project(...)${key === "" ? "" : `.${key}`}: ${problem}`);
		if (typeof piece !== "object" || piece === null || Array.isArray(piece)) {
			refuse("", `expected { prefix, path or repo, ... }, got ${describe(piece)}`);
			continue;
		}
		const project = piece as Readonly<Record<string, unknown>>;
		for (const [key, value] of Object.entries(project)) {
			const entry = Object.hasOwn(PIECE, key) ? PIECE[key] : undefined;
			const expected = entry === undefined ? `unknown key; keys: ${Object.keys(PIECE).join(", ")}` : value === undefined ? undefined : entry.check(value);
			if (expected !== undefined) refuse(key, entry === undefined ? expected : `expected ${expected}, got ${describe(value)}`);
		}
		if (project.prefix === undefined) refuse("prefix", "prefix is required");
		if ((project.path === undefined) === (project.repo === undefined)) refuse("", "expected exactly one of path and repo");
		if (project.repo !== undefined && reposDir === undefined) refuse("repo", "a repo is cloned into reposDir, which is not set");
		const own = new Map<string, string>([[name, "name"]]);
		for (const key of ["prefix", "title"]) if (typeof project[key] === "string" && !own.has(project[key].toLowerCase())) own.set(project[key].toLowerCase(), key);
		for (const [word, key] of own) {
			const first = words.get(word);
			if (first !== undefined) refuse(key === "name" ? "" : key, `its ${key} "${word}" is ${first}; names, prefixes and titles are compared without case`);
			else words.set(word, `the ${key} of project ${name}`);
		}
		const checkout = typeof project.path === "string" ? resolve(folder, project.path) : typeof reposDir === "string" ? resolve(reposDir, name) : undefined;
		if (checkout === undefined) continue;
		const first = checkouts.get(checkout);
		if (first !== undefined) refuse("", `its checkout ${checkout} is the checkout of project ${first}`);
		else checkouts.set(checkout, name);
	}
	return problems;
}

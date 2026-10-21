import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import type { Command, Host } from "@arthur/core/plugin";
import { pluginFiles } from "./plugin-template.ts";

// `arthur plugin new <name> --budget <lines>` (spec/roadmap.md, entry 66): a new plugin package in Arthur's repository, the
// project's checkout, that passes `npm run check`, `npm test` and the structure test as created. Every refusal comes before
// the first write, so a refused call changes no file. docs/commands/plugin.md.

const USAGE = "usage: arthur plugin new <name> --budget <lines> [--project <name>]";
// A plugin's name, as the host checks it at load.
const NAME = /^[a-z]+(-[a-z]+)*$/;
const STRUCTURE = "test/structure.test.ts";
const BUDGETS = /^const BUDGETS = \{ (.*) \};$/gm;
// Names whose function the new files cannot declare: JavaScript's reserved words, and the names those files declare or import.
const UNUSABLE = [
	..."arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function".split(" "),
	..."if implements import in instanceof interface let new null package private protected public return static super switch this throw".split(" "),
	..."true try typeof var void while with yield undefined assert test fakeHost checkOptions summary tools table".split(" "),
];

// Writes `text` to `path` whole: a reader sees the old file or the new one, never half of it.
function replace(path: string, text: string): void {
	writeFileSync(`${path}.${process.pid}`, text);
	renameSync(`${path}.${process.pid}`, path);
}

// What is wrong with the call, or the repository it would change; undefined when nothing is. `files`: the new package's.
function refusal(root: string, name: string, budget: string | undefined, fn: string, files: Readonly<Record<string, string>>): string | undefined {
	if (!NAME.test(name)) return `plugin name "${name}": lowercase letters and dashes, such as uptime or commit-rules`;
	if (UNUSABLE.includes(fn)) return `plugin name "${name}": its function would be named ${fn}, which the new package's files cannot declare`;
	if (budget === undefined) return "--budget is missing: the plugin's line budget, the number its ticket decides";
	if (!/^[1-9]\d*$/.test(budget)) return `--budget "${budget}": a positive whole number of lines`;
	const lines = Object.entries(files).reduce((sum, [path, text]) => sum + (path.startsWith("src/") ? text.split("\n").length - 1 : 0), 0);
	if (Number(budget) < lines) return `--budget ${budget}: below the ${lines} lines the new package's src/ holds as created`;
	if (!existsSync(join(root, "packages", "core", "package.json"))) return `${root} is not Arthur's repository: no packages/core`;
	const structure = existsSync(join(root, STRUCTURE)) ? readFileSync(join(root, STRUCTURE), "utf8") : "";
	const found = [...structure.matchAll(BUDGETS)];
	if (found.length !== 1) return `${join(root, STRUCTURE)} holds ${found.length} lines "const BUDGETS = { ... };", not one`;
	if (!existsSync(join(root, "package-lock.json"))) return `${root} has no package-lock.json`;
	if (existsSync(join(root, "packages", name))) return `packages/${name} exists already`;
	if (new RegExp(`(^|, )"?${name}"?: `).test(found[0]?.[1] ?? "")) return `${name} has a line budget in ${STRUCTURE} already`;
	return undefined;
}

// The lockfile with the package as a workspace, as npm writes it, so `npm ci` installs the checkout as it is.
function locked(text: string, name: string): string {
	const lock = JSON.parse(text);
	const packages = { ...lock.packages, [`node_modules/@arthur/${name}`]: { resolved: `packages/${name}`, link: true }, [`packages/${name}`]: { name: `@arthur/${name}`, license: "Apache-2.0" } };
	lock.packages = Object.fromEntries(Object.entries(packages).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
	return `${JSON.stringify(lock, null, 2)}\n`;
}

export function pluginNew(root: string, args: readonly string[]): number {
	let [positionals, budget]: [string[], string | undefined] = [[], undefined];
	try {
		({ positionals, values: { budget } } = parseArgs({ args: [...args], options: { budget: { type: "string" } }, allowPositionals: true, strict: true }));
	} catch (error) {
		console.error(`${(error as Error).message}\n${USAGE}`);
		return 2;
	}
	const [verb, name = "", ...rest] = positionals;
	if (verb !== "new" || name === "" || rest.length > 0) {
		console.error(USAGE);
		return 2;
	}
	const fn = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
	const files = pluginFiles(name, fn);
	const refused = refusal(root, name, budget, fn, files);
	if (refused !== undefined) {
		console.error(`refused: ${refused}; nothing was written`);
		return 1;
	}
	const [lockPath, structurePath, folder] = [join(root, "package-lock.json"), join(root, STRUCTURE), join(root, "packages", name)];
	const [lock, structure] = [locked(readFileSync(lockPath, "utf8"), name), readFileSync(structurePath, "utf8")];
	// The package appears whole: written in a hidden folder beside, then renamed.
	const draft = join(root, "packages", `.${name}.${process.pid}`);
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(draft, path)), { recursive: true });
		writeFileSync(join(draft, path), text);
	}
	renameSync(draft, folder);
	replace(lockPath, lock);
	const key = name.includes("-") ? `"${name}"` : name;
	replace(structurePath, structure.replace(BUDGETS, (_, entries: string) => `const BUDGETS = { ${entries}, ${key}: ${budget} };`));
	// What `npm ci` would link, so `@arthur/<name>` resolves in arthur.config.ts before the next install.
	const link = join(root, "node_modules", "@arthur", name);
	if (existsSync(dirname(link)) && lstatSync(link, { throwIfNoEntry: false }) === undefined) symlinkSync(join("..", "..", "packages", name), link);
	console.log(`created packages/${name}: package.json, src/${name}.ts, test/${name}.test.ts, docs/${name}.md`);
	console.log(`added ${key}: ${budget} to BUDGETS in ${STRUCTURE}, and @arthur/${name} to package-lock.json`);
	console.log(`next: write what it does, and list ${fn}() in the plugins of arthur.config.ts to load it`);
	return 0;
}

export function pluginCommand(host: Host): Command {
	return {
		name: "plugin",
		doc: new URL("../docs/commands/plugin.md", import.meta.url),
		run({ args, project }) {
			const projects = host.board.projects();
			const found = project === undefined ? projects[0] : projects.find((each) => each.name === project);
			if (found === undefined) throw new Error(`unknown project ${project}; projects: ${projects.map((each) => each.name).join(", ")}`);
			return pluginNew(found.path, args);
		},
	};
}

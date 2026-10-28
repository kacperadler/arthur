import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { insideJob } from "@arthur/core/inside-job";
import type { Command, Host } from "@arthur/core/plugin";
import { pluginFiles } from "./plugin-template.ts";

// `arthur plugin new <name> --budget <lines>` (spec/roadmap.md, entry 66): a new plugin package in Arthur's repository, the
// project's checkout, or in a job its own worktree, that passes `npm run check`, `npm test` and the structure test as created.
// Every refusal comes before the first write, so a refused call changes no file. docs/commands/plugin.md.

const USAGE = "usage: arthur plugin new <name> --budget <lines> [--project <name> | --root <job's worktree>]";
// A plugin's name, as the host checks it at load.
const NAME = /^[a-z]+(-[a-z]+)*$/;
const STRUCTURE = "test/structure.test.ts";
const BUDGETS = /^const BUDGETS = \{\n((?:\t.+,\n\n)*)\};$/gm;
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
	if (found.length !== 1) return `${join(root, STRUCTURE)} holds ${found.length} blocks "const BUDGETS = {", one budget per line and a blank line after each, "};", not one`;
	if (!existsSync(join(root, "package-lock.json"))) return `${root} has no package-lock.json`;
	if (existsSync(join(root, "packages", name))) return `packages/${name} exists already`;
	if (new RegExp(`^\t"?${name}"?: `, "m").test(found[0]?.[1] ?? "")) return `${name} has a line budget in ${STRUCTURE} already`;
	return undefined;
}

// The folder the package goes into, and why it may not, if so: the project's checkout outside a job; in a job (`insideJob`,
// its record in `home`) only its own worktree, given as `--root`, so the package is on the job's branch and goes through review.
function target(checkout: string, root: string | undefined, home: string): [string, string | undefined] {
	const job = insideJob(home);
	if (job === undefined) return [checkout, root === undefined ? undefined : "--root is a job's own worktree; outside a job the package goes into the project's checkout"];
	const worktree = readFileSync(join(home, "jobs", job, "worktree"), "utf8").trim();
	if (root === undefined) return [worktree, `a job writes only in its own worktree: add --root ${worktree}`];
	return [worktree, existsSync(root) && realpathSync(root) === realpathSync(worktree) ? undefined : `--root ${root} is not this job's worktree ${worktree}`];
}

// The lockfile with the package as a workspace, as npm writes it, so `npm ci` installs the checkout as it is.
function locked(text: string, name: string): string {
	const lock = JSON.parse(text);
	const packages = { ...lock.packages, [`node_modules/@arthur/${name}`]: { resolved: `packages/${name}`, link: true }, [`packages/${name}`]: { name: `@arthur/${name}`, license: "Apache-2.0" } };
	lock.packages = Object.fromEntries(Object.entries(packages).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
	return `${JSON.stringify(lock, null, 2)}\n`;
}

function pluginNew(checkout: string, args: readonly string[], home: string): number {
	let [positionals, budget, at]: [string[], string | undefined, string | undefined] = [[], undefined, undefined];
	try {
		({ positionals, values: { budget, root: at } } = parseArgs({ args: [...args], options: { budget: { type: "string" }, root: { type: "string" } }, allowPositionals: true, strict: true }));
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
	const [root, misplaced] = target(checkout, at, home);
	const refused = misplaced ?? refusal(root, name, budget, fn, files);
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
	// In name order: before the first budget whose name sorts after it, else last, so two new plugins' branches merge cleanly.
	replace(structurePath, structure.replace(BUDGETS, (_, entries: string) => {
		const at = [...entries.matchAll(/^\t"?([^":]+)/gm)].find((entry) => (entry[1] ?? "") > name)?.index ?? entries.length;
		return `const BUDGETS = {\n${entries.slice(0, at)}\t${key}: ${budget},\n\n${entries.slice(at)}};`;
	}));
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
		inJob: true,
		run({ args, project }) {
			const projects = host.board.projects();
			const found = project === undefined ? projects[0] : projects.find((each) => each.name === project);
			if (found === undefined) throw new Error(`unknown project ${project}; projects: ${projects.map((each) => each.name).join(", ")}`);
			return pluginNew(found.path, args, dirname(host.folder));
		},
	};
}

// What the planner and the worker are told in Arthur's repository, the one this command writes in: the line that makes a
// new plugin's package from a job, run from the project's checkout since a worktree lacks the arthur.config.ts the CLI reads.
// On another machine the project's repository is bare, without it too: a worker there is told to leave the ticket to local.
export function pluginNewSection(role: string, job: { readonly root: string; readonly worktree: string; readonly machine: string }): string | undefined {
	if ((role !== "planner" && role !== "worker") || !existsSync(join(job.root, "packages", "core", "package.json"))) return undefined;
	if (role === "worker" && job.machine !== "local") return `## A new plugin\n\nThis job runs on machine ${job.machine}, where \`arthur plugin new\` cannot run: the project's repository there is bare and holds no \`arthur.config.ts\`, so the CLI has no \`plugin\` command. A new plugin's package is made on the local machine, never by hand: when your ticket makes one, change nothing and end, saying that its ticket's JSON block needs \`"machine": "local"\`, which places every job of it there, and its worker spawned again with this task.`;
	const [lead, root, rest] = role === "planner"
		? ["When the ticket makes a new plugin package, the plan says that its worker runs on the local machine, spawned with `--machine local`, and its first step is this line, so the worker makes the package with it, not by hand", "<worktree>", "`<worktree>` is the worker's own"]
		: ["When your ticket makes a new plugin package, make it first with this line, not by hand", job.worktree, "from the checkout, `node_modules/.bin/arthur plugin --help` prints the rest"];
	const how = "`<checkout>` is the project's checkout, the first line of `git worktree list`: the CLI reads `arthur.config.ts` from the folder it runs in, and a worktree lacks it; `node_modules/.bin/arthur` is the CLI there, since a job's `PATH` may lack it. `<name>` is the plugin's name, `<lines>` the line budget the ticket decides";
	return `## A new plugin\n\n${lead}. ${how}; ${rest}.\n\n\`\`\`\ncd <checkout> && node_modules/.bin/arthur plugin new <name> --budget <lines> --root ${root}\n\`\`\``;
}

// The coordinator's line, the author of tickets, when a project is Arthur's repository: a new plugin's ticket names the local
// machine in its JSON block, which the machines plugin places every job of it on, with a plan or without one.
export function pluginNewContext(host: Host): string | undefined {
	const names = host.board.projects().filter((project) => existsSync(join(project.path, "packages", "core", "package.json"))).map((project) => project.name);
	return names.length === 0 ? undefined : `A ticket that makes a new plugin package in ${names.join(", ")} gets \`"machine": "local"\` in its JSON block before its first spawn: \`arthur plugin new\` runs only on the local machine, and every job of the ticket then goes there.`;
}

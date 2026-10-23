import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Host, Plugin } from "@arthur/core/plugin";
import { projectFolder } from "./clone.ts";
import { BOARD, init } from "./init.ts";
import { installCommand, installStep } from "./install.ts";
import { onboarding } from "./onboarding.ts";
import { checkOptions } from "./project-options.ts";

// The projects plugin (spec/roadmap.md, entries 41 and 42): the project list in `arthur.config.ts` and nowhere else, served as
// `projects` and kept in `<home>/projects/checkouts` for the worktree guard; one line per project in the coordinator's context;
// `arthur projects` and `/projects`; doctor requirements per project; the install of every new worktree, also served as
// `projects.install`; `arthur init` and the kind `onboarding`. docs/commands/projects.md, docs/commands/init.md.

export type ProjectEntry = {
	readonly name: string;
	readonly prefix: string;
	readonly path?: string;
	readonly repo?: string;
	readonly title?: string;
	readonly about?: string;
	readonly install?: string;
	readonly tracker?: { readonly plugin: string; readonly instance?: string; readonly project: string };
	readonly ci?: { readonly workflow: string };
	readonly commitRules?: { readonly regex: string } | { readonly words: string } | { readonly file: string };
	readonly autoMerge?: boolean;
	readonly requires?: { readonly os?: string; readonly arch?: string; readonly tools?: readonly string[] };
	readonly docker?: boolean;
	// The files the roles read in its repository; left out, `spec/vision.md`, `.agents/arthur/criteria` and `.agents/arthur/roles`.
	readonly prompts?: { readonly vision?: string; readonly criteriaDir?: string; readonly rolesDir?: string };
};

// As `projects` serves it: the entry, its folder absolute and its title set.
export type Project = ProjectEntry & { readonly path: string; readonly title: string };

export type ProjectsOptions = { readonly enabled?: boolean; readonly list: readonly ProjectEntry[]; readonly reposDir?: string };

const HEADER =
	"A prefix, name or title, in any case, names that project, even when another project's title or about holds the word; " +
	"a word found in only one project's title or about names it; a word that fits none or several: ask which, naming the candidates. " +
	"Without `--project` a spawn or ticket goes to the first, the main one.";

export function projects(options: ProjectsOptions): Plugin {
	return {
		name: "projects",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			const { list, reposDir } = host.options as ProjectsOptions;
			const all: Project[] = list.map((entry) => ({ ...entry, title: entry.title ?? entry.name, path: projectFolder(entry, reposDir, dirname(host.folder)) }));
			keepCheckouts(host.folder, all);
			host.provide("projects", () => all);
			host.provide("coordinator.context", () => [HEADER, ...all.map(projectLine)].join("\n"));
			host.provide("doctor", () => all.flatMap(requirements));
			// The install `arthur merge` runs on main (delivery): the project's at a commit of its repository, "" for none.
			host.provide("projects.install", ({ project, commit }: { readonly project: string; readonly commit: string }) => {
				const entry = all.find((each) => each.name === project);
				if (entry === undefined) throw new Error(`no project ${project}`);
				return installCommand(entry, entry.path, commit);
			});
			host.commands.register({
				name: "projects",
				doc: new URL("../docs/commands/projects.md", import.meta.url),
				inJob: true,
				phone: { about: "every project: its line, folder, open tickets and install", reply: (text) => (text.trim() === "" ? overview(host, all) : "usage: /projects") },
				run({ args }) {
					if (args.length > 0) {
						console.error("usage: arthur projects");
						return 2;
					}
					console.log(overview(host, all));
				},
			});
			host.commands.register({ name: "init", doc: new URL("../docs/commands/init.md", import.meta.url), run: ({ args, project }) => init(all, args, project, host.jobs.criteria(), host.code) });
			host.jobs.prepare(installStep(host, all));
			onboarding(host, all);
		},
	};
}

// Each project's name and checkout, `<name> <folder>` a line, in `<folder>/checkouts`, which the worktree guard of every running
// job reads on each tool call (packages/core/src/job-place.ts); rewritten, whole, only when the list changed.
function keepCheckouts(folder: string, all: readonly Project[]): void {
	const [file, text] = [join(folder, "checkouts"), all.map((project) => `${project.name} ${project.path}\n`).join("")];
	let kept: string | undefined;
	try {
		kept = readFileSync(file, "utf8");
	} catch {}
	if (kept === text) return;
	writeFileSync(`${file}.${process.pid}`, text);
	renameSync(`${file}.${process.pid}`, file);
}

// `SH Shop (web-shop): <about>`: the name left out when it is the title, the about when there is none.
function projectLine(project: Project): string {
	return `${project.prefix} ${project.title}${project.title === project.name ? "" : ` (${project.name})`}${project.about === undefined ? "" : `: ${project.about}`}`;
}

// Under each project's line: its folder, its open tickets (not merged or dropped) and the install a new worktree gets. A board
// that cannot be read costs that project's count only; two lockfiles committed since setup refuse the answer, naming the project.
function overview(host: Host, all: readonly Project[]): string {
	return all
		.map((project) => {
			let board: string;
			try {
				const count = host.board.list(project.name).filter((ticket) => ticket.status !== "merged" && ticket.status !== "dropped").length;
				board = `${count} open ticket${count === 1 ? "" : "s"}`;
			} catch (error) {
				board = `board unreadable: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`;
			}
			return `${projectLine(project)}\n  ${project.path}; ${board}; install: ${installCommand(project, project.path, "HEAD") || "none"}`;
		})
		.join("\n");
}

// The requirements of `arthur doctor` (entry 80), none critical: `check` answers `ok` or `missing: <reason>`. The board's fix walks
// a new owner, through `arthur setup`, to `arthur init`.
function requirements({ name, about, path }: Project) {
	return [
		{ name: `${name} about`, check: () => (about === undefined ? "missing: no about" : "ok"), costs: "the coordinator knows it only by prefix, name and title", fix: `add about to project ${name} in arthur.config.ts`, critical: false },
		{ name: `${name} board`, check: () => (existsSync(join(path, BOARD)) ? "ok" : `missing: no ${BOARD}`), costs: `no tickets for ${name}`, fix: `arthur init ${name}`, critical: false },
	];
}

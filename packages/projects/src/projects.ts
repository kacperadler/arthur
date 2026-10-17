import { dirname } from "node:path";
import type { Host, Plugin } from "@arthur/core/plugin";
import { projectFolder } from "./clone.ts";
import { installCommand, installStep } from "./install.ts";
import { checkOptions } from "./project-options.ts";

// The projects plugin (spec/roadmap.md, entry 41): the project list in `arthur.config.ts` and nowhere else, served as
// `projects`; one line per project in the coordinator's context; `arthur projects` and `/projects`; a doctor requirement per
// project; and the install of every new worktree. docs/commands/projects.md.

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
		options,
		check: checkOptions,
		setup(host) {
			const { list, reposDir } = host.options as ProjectsOptions;
			const all: Project[] = list.map((entry) => ({ ...entry, title: entry.title ?? entry.name, path: projectFolder(entry, reposDir, dirname(host.folder)) }));
			host.provide("projects", () => all);
			host.provide("coordinator.context", () => [HEADER, ...all.map(projectLine)].join("\n"));
			host.provide("doctor", () => all.map(requirement));
			host.commands.register({
				name: "projects",
				doc: new URL("../docs/commands/projects.md", import.meta.url),
				phone: { about: "every project: its line, folder, open tickets and install", reply: (text) => (text.trim() === "" ? overview(host, all) : "usage: /projects") },
				run({ args }) {
					if (args.length > 0) {
						console.error("usage: arthur projects");
						return 2;
					}
					console.log(overview(host, all));
				},
			});
			host.jobs.prepare(installStep(host, all));
		},
	};
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

// One requirement of `arthur doctor` (entry 80): `check` answers `ok` or `missing: <reason>`.
function requirement(project: Project) {
	return {
		name: `${project.name} about`,
		check: () => (project.about === undefined ? "missing: no about" : "ok"),
		costs: "the coordinator knows it only by prefix, name and title",
		fix: `add about to project ${project.name} in arthur.config.ts`,
		critical: false,
	};
}

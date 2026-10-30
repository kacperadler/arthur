import { existsSync, realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe } from "@arthur/core";
import { projectFolder } from "./clone.ts";
import { checkProjects, type Written } from "./project-options.ts";
import type { Project, ProjectEntry } from "./projects.ts";

// Each project's file (AR0589): `<folder>/project.config.ts`, a default export of pieces, each made by its plugin's helper,
// `{ <plugin>: <value> }`: exactly one `projects.project(...)`, at most one of each plugin. Every refusal names the file:
// docs/commands/projects.md, "A project's file".

export const FILE = "project.config.ts";

// The projects of `folders` in their order, each path counted from its folder, its written prompts inside that folder at its
// real path; throws every problem, a line each. `home` is Arthur's home folder, which `reposDir` must be outside of.
export async function readProjects(folders: readonly string[], reposDir: string | undefined, home: string): Promise<Project[]> {
	const problems: string[] = [];
	const written: (Written & { readonly pieces: Readonly<Record<string, unknown>> })[] = [];
	for (const each of folders) {
		const folder = resolve(each);
		const file = join(folder, FILE);
		if (!existsSync(file)) {
			problems.push(`${file}: missing; each folder of projects.folders holds its project's ${FILE}`);
			continue;
		}
		// The file is named by the config at run time, so it is imported here, as the core imports arthur.config.ts.
		const loaded = await import(pathToFileURL(file).href).then(
			(module: { readonly default?: unknown }) => module.default,
			(error: Error) => new Error(error.message.split("\n")[0]),
		);
		const fail = (problem: string) => problems.push(`${file}: ${problem}`);
		if (loaded instanceof Error) {
			fail(`does not load: ${loaded.message}`);
			continue;
		}
		if (!Array.isArray(loaded)) {
			fail(`expected a default export of the project's pieces, such as export default [projects.project({ ... }), uptime.project([...])], got ${describe(loaded)}`);
			continue;
		}
		const pieces: Record<string, unknown> = {};
		const at = new Map<string, number>();
		loaded.forEach((piece: unknown, index) => {
			const keys = typeof piece === "object" && piece !== null && !Array.isArray(piece) ? Object.keys(piece) : [];
			const [key] = keys;
			if (keys.length !== 1 || key === undefined) return fail(`[${index}]: expected a piece made by a plugin's helper, such as uptime.project([...]), one key, got ${describe(piece)}`);
			const first = at.get(key);
			if (first !== undefined) return fail(`[${index}]: a second ${key}.project(...); the first is [${first}]; one piece per plugin`);
			at.set(key, index);
			pieces[key] = (piece as Readonly<Record<string, unknown>>)[key];
		});
		if (!at.has("projects")) fail("no projects.project({ prefix, path or repo, ... }); each project file holds one");
		else {
			const { projects: piece, ...others } = pieces;
			written.push({ name: basename(folder), file, folder, piece, pieces: others });
		}
	}
	problems.push(...checkProjects(written, reposDir));
	if (problems.length > 0) throw new Error(problems.join("\n"));
	return written.map(({ name, folder, piece, pieces }) => {
		const entry = { ...(piece as Omit<ProjectEntry, "name">), name };
		const real = realpathSync(folder);
		const prompts = entry.prompts && Object.fromEntries(Object.entries(entry.prompts).map(([key, path]) => [key, join(real, path)]));
		const located = { ...entry, ...(entry.path === undefined ? {} : { path: resolve(folder, entry.path) }) };
		return { ...entry, ...(prompts === undefined ? {} : { prompts }), title: entry.title ?? name, path: projectFolder(located, reposDir, home), folder: real, pieces };
	});
}

import { basename } from "node:path";
import { projectList } from "./board.ts";
import { topLevel } from "./git.ts";

// The project `name` names (spec/roadmap.md, entries 9 and 41), as the binary checks `--project` before a command runs.
// `lists`: what every provider of `projects` returned; with a list, `name` is a name in it and undefined is the first, the main
// one; without one, the only project is the repository `folder` is in, named by its folder, its `path` that repository. Any
// other name is refused, naming the known projects.
export function knownProject(folder: string, lists: readonly unknown[], name: string | undefined): { readonly name: string; readonly path: string } {
	if (lists.length > 0) {
		const all = projectList(lists);
		const found = name === undefined ? all[0] : all.find((each) => each.name === name);
		if (found === undefined) throw new Error(`unknown project ${name}; projects: ${all.map((each) => each.name).join(", ")}`);
		return found;
	}
	const root = topLevel(folder);
	if (root === undefined && name !== undefined) throw new Error(`unknown project ${name}; no plugin provides the project list and ${folder} is not in a Git repository`);
	if (root === undefined) throw new Error(`${folder} is not in a Git repository; a job starts from its HEAD`);
	if (name !== undefined && name !== basename(root)) throw new Error(`unknown project ${name}; the only project is ${basename(root)}`);
	return { name: basename(root), path: root };
}

// The repository a job of `project` starts from, and the project's name.
export function checkout(folder: string, lists: readonly unknown[], project: string | undefined): { readonly root: string; readonly project: string } {
	const found = knownProject(folder, lists, project);
	const root = lists.length > 0 ? topLevel(found.path) : found.path;
	if (root === undefined) throw new Error(`project ${found.name}: ${found.path} is not in a Git repository; a job starts from its HEAD`);
	return { root, project: found.name };
}

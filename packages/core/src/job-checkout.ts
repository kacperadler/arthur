import { basename } from "node:path";
import { projectList } from "./board.ts";
import { topLevel } from "./git.ts";
import { type ProjectCheckout, promptFiles } from "./roles.ts";

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

// The repository a job of `project` starts from, the project's name, and where its prompt files are.
export function checkout(folder: string, lists: readonly unknown[], project: string | undefined): ProjectCheckout {
	const found = knownProject(folder, lists, project);
	const root = lists.length > 0 ? topLevel(found.path) : found.path;
	if (root === undefined) throw new Error(`project ${found.name}: ${found.path} is not in a Git repository; a job starts from its HEAD`);
	return { root, project: found.name, files: promptFiles(found) };
}

// Every declared project's main checkout, `<name> <root>` a line, which a job's record keeps for its worktree guard; a project's
// folder in no Git repository (not cloned yet) stands for its checkout. Without a list, the job's own `root` is the only one.
export function checkouts(lists: readonly unknown[]): string {
	return lists.length === 0 ? "" : projectList(lists).map((each) => `${each.name} ${topLevel(each.path) ?? each.path}`).join("\n");
}

import { basename } from "node:path";
import { projectList } from "./board.ts";
import { topLevel } from "./git.ts";

// The repository a job of `project` starts from, and the project's name (spec/roadmap.md, entries 9 and 41). `lists`: what
// every provider of `projects` returned; with a list, `project` is a name in it and undefined is the first, the main one;
// without one, the only project is the repository `folder` is in, named by its folder.
export function checkout(folder: string, lists: readonly unknown[], project: string | undefined): { readonly root: string; readonly project: string } {
	if (lists.length > 0) {
		const all = projectList(lists);
		const found = project === undefined ? all[0] : all.find((each) => each.name === project);
		if (found === undefined) throw new Error(`unknown project ${project}; projects: ${all.map((each) => each.name).join(", ")}`);
		const root = topLevel(found.path);
		if (root === undefined) throw new Error(`project ${found.name}: ${found.path} is not in a Git repository; a job starts from its HEAD`);
		return { root, project: found.name };
	}
	const root = topLevel(folder);
	if (root === undefined) throw new Error(`${folder} is not in a Git repository; a job starts from its HEAD`);
	if (project !== undefined && project !== basename(root)) throw new Error(`unknown project ${project}; the only project is ${basename(root)}`);
	return { root, project: basename(root) };
}

// Every declared project's main checkout, `<name> <root>` a line, which a job's record keeps for its worktree guard; a project's
// folder in no Git repository (not cloned yet) stands for its checkout. Without a list, the job's own `root` is the only one.
export function checkouts(lists: readonly unknown[]): string {
	return lists.length === 0 ? "" : projectList(lists).map((each) => `${each.name} ${topLevel(each.path) ?? each.path}`).join("\n");
}

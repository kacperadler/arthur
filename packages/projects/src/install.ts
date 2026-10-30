import { spawnSync } from "node:child_process";
import type { Prepare } from "@arthur/core/plugin";

// The install of each new worktree's dependencies (spec/roadmap.md, entry 41): docs/commands/projects.md, "Install".

type Installs = { readonly name: string; readonly install?: string };

// The frozen install of each lockfile the plugin knows, found at the top of the repository.
const LOCKFILES: Readonly<Record<string, string>> = {
	"bun.lock": "bun install --frozen-lockfile",
	"package-lock.json": "npm ci",
	"pnpm-lock.yaml": "pnpm install --frozen-lockfile",
	"composer.lock": "composer install",
	"uv.lock": "uv sync --frozen",
};

// What installs `project` at `commit` of its repository `root`: its `install`, else its one known lockfile's; "" is nothing.
// Two known lockfiles and no `install` are refused, naming the project and the files.
export function installCommand(project: Installs, root: string, commit: string): string {
	if (project.install !== undefined) return project.install;
	const listed = spawnSync("git", ["-C", root, "ls-tree", "--name-only", commit], { encoding: "utf8" });
	const found = listed.status === 0 ? listed.stdout.split("\n").filter((name) => Object.hasOwn(LOCKFILES, name)) : [];
	if (found.length > 1)
		throw new Error(`project ${project.name}: two known lockfiles (${found.join(", ")}) and no install; set install in its projects.project(...)`);
	return found[0] === undefined ? "" : (LOCKFILES[found[0]] ?? "");
}

// The `prepare` of every kind: the install, as the variable `ARTHUR_INSTALL`, which the job's wrapper runs first, in the job's
// worktree and scope on its machine, with the PATH the prepares returned (the nvm plugin's Node first); one that fails ends the
// job `failed`, its worktree kept. A continue's worktree keeps its spawn's install.
export function installStep(list: readonly Installs[]): Prepare {
	return (job, _env, continued) => {
		const project = list.find((each) => each.name === job.project);
		if (continued || project === undefined) return;
		const command = installCommand(project, job.root, job.base);
		return command === "" ? undefined : { ARTHUR_INSTALL: command };
	};
}

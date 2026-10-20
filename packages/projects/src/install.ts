import { spawnSync } from "node:child_process";
import type { Host, Prepare } from "@arthur/core/plugin";

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
		throw new Error(`project ${project.name}: two known lockfiles (${found.join(", ")}) and no install; set install in its entry of arthur.config.ts`);
	return found[0] === undefined ? "" : (LOCKFILES[found[0]] ?? "");
}

// The `prepare` of every kind: the install runs in the job's worktree, on the job's machine, with the PATH a prepare before it
// returned (the nvm plugin's Node first); one that fails refuses the spawn. A continue's worktree keeps its spawn's install.
export function installStep(host: Host, list: readonly Installs[]): Prepare {
	return async (job, env, continued) => {
		const project = list.find((each) => each.name === job.project);
		if (continued || project === undefined) return;
		const command = installCommand(project, job.root, job.base);
		if (command === "") return;
		const script = 'cd "$1" || exit; if [ -n "$3" ]; then export PATH="$3"; fi; exec sh -c "$2"';
		const ran = await host.jobs.run(job.machine, ["sh", "-c", script, "install", job.worktree, command, env.PATH ?? ""]);
		if (ran.code === 0) return;
		const last = (ran.stderr.trim() || ran.stdout.trim()).split("\n").at(-1);
		throw new Error(`project ${project.name}: install \`${command}\` exited ${ran.code ?? "on a signal"}${last ? `: ${last}` : ""}`);
	};
}

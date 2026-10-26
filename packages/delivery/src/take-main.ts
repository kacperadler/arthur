import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configRefusal } from "@arthur/core/git-config";
import type { Command, Host } from "@arthur/core/plugin";

// The last merge `arthur merge` made in a project, `<folder>/<project>/last-merge` (AR0441): the stray-commit check lists main's
// commits from it, not from main's last merge commit, which a job that can commit on main can make too. `arthur take-main`, on
// the owner's recorded decision, sets it to main's HEAD: main taken as it is. docs/commands/take-main.md.

const USAGE = "usage: arthur take-main [--decision <id>] [--project <name>]";
const HASH = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

type Git = (...words: string[]) => { readonly status: number | null; readonly stdout: string };

// Written whole under a temporary name, then renamed.
export function saveLastMerge(host: Host, project: string, hash: string): void {
	const file = join(host.folder, project, "last-merge");
	mkdirSync(join(host.folder, project), { recursive: true });
	writeFileSync(`${file}.${process.pid}`, `${hash}\n`);
	renameSync(`${file}.${process.pid}`, file);
}

// The recorded hash, `on` when it is on HEAD's first-parent line (HEAD itself included); undefined when the file is missing,
// holds no hash, or names no ancestor of HEAD. An ancestor off that line (a merge that made it a second parent) is not `on`.
export function lastMerge(host: Host, project: string, git: Git): { readonly hash: string; readonly on: boolean } | undefined {
	const file = join(host.folder, project, "last-merge");
	const hash = existsSync(file) ? readFileSync(file, "utf8").trim() : "";
	if (!HASH.test(hash) || git("merge-base", "--is-ancestor", hash, "HEAD").status !== 0) return undefined;
	// From HEAD down its first parents to the first ancestor of `hash`: the last one's first parent is `hash` when on the line.
	const below = git("log", "--first-parent", "--format=%P", `${hash}..HEAD`).stdout.trim().split("\n").at(-1) ?? "";
	return { hash, on: below === "" || below.split(" ")[0] === hash };
}

export function takeMainCommand(host: Host): Command {
	return {
		name: "take-main",
		doc: new URL("../docs/commands/take-main.md", import.meta.url),
		run({ args, project }) {
			const [flag, id = "", extra] = args;
			const wrong = extra !== undefined ? `unknown argument ${extra}` : flag !== undefined && flag !== "--decision" ? `unknown argument ${flag}` : flag !== undefined && (id === "" || id.startsWith("-")) ? "--decision needs a value" : undefined;
			if (wrong !== undefined) {
				console.error(`arthur take-main: ${wrong}\n${USAGE}`);
				return 2;
			}
			const projects = host.board.projects();
			const found = project === undefined ? projects[0] : projects.find((each) => each.name === project);
			if (found === undefined) throw new Error(`no project ${project ?? ""} in the project list`);
			// No program the checkout's own config may name runs (AR0330, AR0380, AR0384), as in `arthur merge`.
			const planted = configRefusal(found.path);
			if (planted !== "") throw new Error(`${planted}; nothing taken`);
			const head = spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", "-C", found.path, "rev-parse", "--verify", "--quiet", "HEAD^{commit}"], { encoding: "utf8" }).stdout.trim();
			const owner = host.call<string>("decision.owner", { id, what: "arthur take-main", kind: "merge", use: `take-main ${found.name} ${head}` });
			if (owner !== "") throw new Error(`${owner}; nothing taken`);
			saveLastMerge(host, found.name, head);
			console.log(`took main of ${found.name} as it is at ${head.slice(0, 7)}: the next arthur merge lists code commits from there`);
		},
	};
}

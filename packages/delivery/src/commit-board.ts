import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { checkConfig } from "@arthur/core/git-config";
import { takeLock } from "@arthur/core/lock";
import type { Command, Host } from "@arthur/core/plugin";
import { stepRunner } from "./merge-checks.ts";
import { vetted } from "./merge-outcome.ts";

// `arthur commit-board '<subject>'` (AR0738; AR0667's plan, T2): the one way the coordinator and a project agent commit a project's board on main. Only the
// board's files that changed, none a symlink or a folder, after the config check and the project's `commit-msg` script, the hooks off, as the merge commits
// its own `spec:` (merge-outcome.ts); what else the checkout holds, staged or not, stays as it was. `delivery.commit` commits the same way the paths another
// plugin wrote (`arthur init`). docs/commands/commit-board.md.

const USAGE = "usage: arthur commit-board '<subject>' [--project <name>]";
// What Arthur's commands write on main and the coordinator commits: the board, the decision log, the schedule, each ticket's files, the filed reports with
// their pages, and the changelog a merge whose `spec:` commit was refused left.
export const BOARD: readonly string[] = [
	"spec/build.json",
	"spec/decisions.jsonl",
	"spec/schedule.json",
	"CHANGELOG.md",
	":(glob)spec/features/**/*.md",
	...["quality/*.md", "retro/*.md", "retro/*.html", "pyramid/*.md", "pyramid/*.html"].map((files) => `:(glob)spec/${files}`),
];

// A path of a commit: a file's own path, or a glob pathspec, `**/` any folders or none, `*` anything but a slash, any other character itself (strict: `u`).
export type Commit = { readonly project: string; readonly subject: string; readonly paths: readonly string[] };
const GLOB = ":(glob)";
const glob = (spec: string) => new RegExp(`^${spec.slice(GLOB.length).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("**/", "(.+/)?").replaceAll("*", "[^/]*")}$`, "su");

export function commitBoardCommand(host: Host, stepSeconds: number): Command {
	return {
		name: "commit-board",
		doc: new URL("../docs/commands/commit-board.md", import.meta.url),
		run({ args, project }) {
			const [subject = "", extra] = args;
			const wrong = extra !== undefined ? `one subject; got ${args.length} words` : subject.trim() === "" ? "no subject" : subject.startsWith("-") ? `unknown flag ${subject}` : undefined;
			if (wrong !== undefined) {
				console.error(`arthur commit-board: ${wrong}\n${USAGE}`);
				return 2;
			}
			console.log(commitPaths(host, stepSeconds, { project: project ?? host.board.projects()[0]?.name ?? "", subject, paths: BOARD }));
		},
	};
}

// Commits as `subject` each file `paths` name that changed in the project's checkout, new and deleted ones included, and answers its line,
// `committed <subject>: <commit>, <n> files` or `nothing to commit: ...`. A refusal throws, with nothing committed and nothing left staged.
export function commitPaths(host: Host, stepSeconds: number, { project, subject, paths }: Commit): string {
	const root = host.board.projects().find((each) => each.name === project)?.path;
	if (root === undefined) throw new Error(`no project ${project} in the project list`);
	// The merge's own lock: a check that fails on main resets it, and a commit made on top of the merge commit meanwhile would go with it.
	mkdirSync(join(host.folder, project), { recursive: true });
	const lock = takeLock(join(host.folder, project, "merge.lock"));
	if ("heldBy" in lock) throw new Error(`main of ${project} is held by pid ${lock.heldBy}, a merge or another commit; nothing committed: run it again once that ended`);
	const cache = mkdtempSync(join(host.folder, "cache_"));
	try {
		// No program the checkout's own config may name runs (AR0330, AR0380, AR0384), as in `arthur merge`.
		const { refusal, pins } = checkConfig(root);
		if (refusal !== "") throw new Error(`${refusal}; nothing committed`);
		const git = (...words: string[]) => spawnSync("git", ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...pins, "-C", root, ...words], { encoding: "utf8" });
		const status = git("status", "--porcelain", "--no-renames", "-z", "--untracked-files=all", "--", ...paths);
		if (status.status !== 0) throw new Error(`git status in ${root} failed: ${status.stderr.trim()}; nothing committed`);
		// `XY <path>` an entry. Git also lists each file below a folder named as a pathspec: the commit's is a path of `paths` itself, or one a glob matches whole.
		const globs = paths.filter((spec) => spec.startsWith(GLOB)).map(glob);
		const changed = status.stdout.split("\0").map((entry) => entry.slice(3)).filter((path) => paths.includes(path) || globs.some((each) => each.test(path)));
		if (changed.length === 0) return `nothing to commit: no file of ${paths.map((path) => path.replace(/^:\(glob\)/, "")).join(", ")} changed in ${root}`;
		const links = changed.filter((path) => lstatSync(join(root, path), { throwIfNoEntry: false })?.isFile() === false);
		if (links.length > 0) throw new Error(`${links.join(", ")}: a symlink or a folder, which this commit never holds; remove it; nothing committed`);
		// The project's own check runs as a step of `arthur merge` does: in the steps' sandbox, on the PATH the nvm plugin answers for the checkout.
		const run = (command: string) => {
			const path = host.collect<string>("nvm.path", { root })[0] ?? "";
			return stepRunner(root, host.jobs.slice, console.log, stepSeconds, [host.folder])(host.sandbox(root, cache, console.log))(command, { ...process.env, ...(path && { PATH: path }) });
		};
		// Each path as it is, no pathspec: a new file added, a missing one removed, one whose removal is staged already left so.
		const added = git("update-index", "--add", "--remove", "--", ...changed);
		try {
			const checked = added.status === 0 ? vetted({ git, run }, subject, changed) : added;
			const done = checked.status === 0 ? git("commit", "-m", subject, "--", ...changed) : checked;
			if (done.status === 0) return `committed ${subject}: ${git("rev-parse", "--short", "HEAD").stdout.trim()}, ${changed.length} file${changed.length === 1 ? "" : "s"}`;
			throw new Error(`${subject} not committed: ${done.stderr.trim().split("\n").at(-1)}; fix what it names, then run it again`);
		} catch (error) {
			// A check that threw (a package.json at HEAD that is no JSON) leaves nothing staged either.
			git("reset", "--", ...changed);
			throw error;
		}
	} finally {
		rmSync(cache, { recursive: true, force: true });
		lock.release();
	}
}

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Command } from "./commands.ts";
import { arthurVersion } from "./job-machine.ts";
import type { Plugin } from "./plugin.ts";

// `arthur update [<tag or commit>]` (spec/roadmap.md, entry 106): Arthur's own checkout, found from the core's folder as the
// session plugin's restart guard finds it, moved to the newest release tag or the one given, then `npm ci`. docs/commands/update.md.

const USAGE = "usage: arthur update [<tag or commit>]";

const git = (root: string, args: readonly string[]) => spawnSync("git", ["--no-replace-objects", "-C", root, ...args], { encoding: "utf8" });
const said = (run: SpawnSyncReturns<string>) => (run.error?.message ?? run.stderr).trim().split("\n")[0] || `exit code ${run.status}`;
// git's stdout, or an error naming the step and git's first line.
function must(root: string, args: readonly string[]): string {
	const run = git(root, args);
	if (run.status !== 0) throw new Error(`git ${args[0]} in ${root}: ${said(run)}`);
	return run.stdout;
}
// `npm ci` in `root`, its output on stderr; undefined when it passed, else why not.
function npmCi(root: string): string | undefined {
	const run = spawnSync("npm", ["ci"], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
	return run.status === 0 ? undefined : (run.error?.message ?? `exit code ${run.status ?? run.signal}`);
}

// The lines to print, `updated <old> to <new>` or `up to date: <version>` first; after an update, who restarts `arthur run` on the
// new code: the session plugin's restart guard among the enabled `plugins`, unless `restartGuard: false`, else the owner. Throws,
// naming what, on each refusal, and once `npm ci` failed, after going back to the commit (or branch) before and running `npm ci` there again.
export function update(core: string, target: string | undefined, plugins: readonly Pick<Plugin, "name" | "options">[]): string[] {
	const top = git(core, ["rev-parse", "--show-toplevel"]);
	if (top.status !== 0) throw new Error(`${core} is not in a Git checkout (${said(top)}); install Arthur from a clone, as docs/setup.md, step 4, says`);
	const root = top.stdout.trim();
	const changed = must(root, ["diff", "--name-only", "HEAD", "--"]).split("\n").filter((line) => line !== "");
	if (changed.length > 0) throw new Error(`${root} has changed tracked files: ${changed.join(", ")}; commit, stash or undo them first`);
	const branch = git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
	const on = branch.status === 0 ? branch.stdout.trim() : undefined;
	if (target === undefined && on !== undefined) throw new Error(`${on} is a development checkout; update it with git pull`);
	must(root, ["fetch", "--quiet", "--tags", "origin"]);
	const wanted = target ?? must(root, ["tag", "--list", "v*", "--sort=-v:refname"]).split("\n")[0];
	if (!wanted) throw new Error(`${root} has no release tag v* after git fetch --tags origin`);
	const commit = git(root, ["rev-parse", "--verify", "--quiet", `${wanted}^{commit}`]);
	if (commit.status !== 0) throw new Error(`${wanted} is no tag or commit of ${root} after git fetch --tags origin`);
	const [from, to, old] = [must(root, ["rev-parse", "HEAD"]).trim(), commit.stdout.trim(), arthurVersion(core)];
	if (from === to) return [`up to date: ${old}`];
	must(root, ["checkout", "--quiet", to, "--"]);
	const failed = npmCi(root);
	if (failed !== undefined) {
		must(root, ["checkout", "--quiet", on ?? from, "--"]);
		const again = npmCi(root);
		const back = again === undefined ? "npm ci ran again there" : `npm ci failed there too (${again}): run npm ci in ${root} by hand`;
		throw new Error(`npm ci failed at ${wanted} (${failed}); back at ${old}, ${back}`);
	}
	const guarded = plugins.some((plugin) => plugin.name === "session" && plugin.options?.restartGuard !== false);
	const restart = guarded ? "under its service, arthur run restarts on it once no job and no merge runs (the session plugin's restart guard)" : "restart arthur run on it once no job runs: systemctl --user restart arthur";
	return [`updated ${old} to ${arthurVersion(core)}`, restart];
}

// `plugins`: the enabled ones, none when arthur.config.ts did not load.
export function updateCommand(plugins: () => readonly Plugin[]): Command {
	return {
		name: "update",
		doc: new URL("../docs/commands/update.md", import.meta.url),
		run({ args }) {
			if (args.length > 1 || args[0]?.startsWith("-")) {
				console.error(USAGE);
				return 2;
			}
			for (const line of update(join(import.meta.dirname, ".."), args[0], plugins())) console.log(line);
		},
	};
}

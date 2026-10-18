import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { put } from "./request.ts";

// The restart guard (spec/roadmap.md, entry 37): at its start `arthur run` notes the commit of Arthur's own checkout and the
// code it loaded, the `src/` of the core and of each enabled plugin (`host.code`); a commit since then that changed that code
// makes a restart due: every spawn and continue is refused, unless `--ignore-restart`, until `arthur run` starts again, and the
// coordinator's context says so: docs/session.md, "The restart guard".

const LOADED = "loaded.json";
// `root` the checkout holding the core, `commit` its HEAD then, `at` the start, `paths` the `src/` folders in `root`.
type Loaded = { readonly root: string; readonly commit: string; readonly at: string; readonly paths: readonly string[] };

// `git -C <root> <args>`; an exit code not in `ok` throws, with git's first line.
function git(root: string, args: readonly string[], ok: readonly (number | null)[] = [0]) {
	const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
	if (!ok.includes(run.status)) throw new Error(`git ${args[0]} in ${root}: ${(run.error?.message ?? run.stderr).trim().split("\n")[0]}`);
	return run;
}

// At `arthur run`'s start. The core outside a Git checkout (Arthur installed without one) leaves nothing to guard; a plugin's
// folder outside the core's checkout is not watched.
export function noteLoaded(host: Host): void {
	const file = join(host.folder, LOADED);
	const places = host.code.map((folder) => git(folder, ["rev-parse", "--show-toplevel", "--show-prefix"], [0, 128]));
	const root = places[0]?.status === 0 ? places[0].stdout.split("\n")[0] : undefined;
	const commit = root === undefined ? undefined : git(root, ["rev-parse", "--verify", "--quiet", "HEAD"], [0, 1]);
	if (root === undefined || commit?.status !== 0) return rmSync(file, { force: true });
	const paths = places.flatMap(({ status, stdout }) => {
		const [top, prefix] = stdout.split("\n");
		return status === 0 && top === root ? [`${prefix}src`] : [];
	});
	put(file, JSON.stringify({ root, commit: commit.stdout.trim(), at: host.clock.now().toISOString(), paths } satisfies Loaded));
}

// What `arthur run` noted, and the commits on HEAD's first-parent line since then that changed its code, oldest first, each the
// ticket of its `Merge <id>: ...` subject, else its short hash; undefined when nothing is noted. A broken note throws.
function restartDue(folder: string): { readonly loaded: Loaded; readonly due: readonly string[] } | undefined {
	const file = join(folder, LOADED);
	if (!existsSync(file)) return undefined;
	const loaded = parse(readFileSync(file, "utf8"));
	if (loaded === undefined) throw new Error(`${file} is not what arthur run notes at its start; it is noted again at the next start`);
	const { root, commit, paths } = loaded;
	// The code as it stands against the code loaded: a change undone since is no change.
	if (git(root, ["diff", "--quiet", commit, "HEAD", "--", ...paths], [0, 1]).status === 0) return { loaded, due: [] };
	const log = git(root, ["log", "--first-parent", "--reverse", "--format=%h %s", `${commit}..HEAD`, "--", ...paths]).stdout;
	const due = log.split("\n").filter((line) => line !== "").map((line) => /^\S+ Merge ([A-Z]+\d+):/.exec(line)?.[1] ?? line.split(" ")[0] ?? line);
	// HEAD moved back, past the commit noted (a reset): the commit it is at now.
	return { loaded, due: due.length > 0 ? due : [git(root, ["rev-parse", "--short", "HEAD"]).stdout.trim()] };
}

function parse(text: string): Loaded | undefined {
	try {
		const { root, commit, at, paths } = JSON.parse(text) as Partial<Record<keyof Loaded, unknown>>;
		const listed = Array.isArray(paths) && paths.length > 0 && paths.every((path) => typeof path === "string");
		if (typeof root === "string" && typeof commit === "string" && /^[0-9a-f]{40,64}$/.test(commit) && typeof at === "string" && !Number.isNaN(Date.parse(at)) && listed) return { root, commit, at, paths };
	} catch {}
	return undefined;
}

// `beforeSpawn`, of `arthur continue` too, and the coordinator's context; with `restartGuard: false` neither is registered.
export function registerGuard(host: Host): void {
	const since = (loaded: Loaded) => {
		const { date, time } = host.clock.local(new Date(loaded.at));
		return `since arthur run started ${date} ${time} at ${loaded.commit.slice(0, 7)}`;
	};
	host.jobs.beforeSpawn(({ ignoreRestart }) => {
		const state = ignoreRestart ? undefined : restartDue(host.folder);
		if (state === undefined || state.due.length === 0) return undefined;
		return `restart due: ${state.due.join(", ")} changed Arthur's code ${since(state.loaded)}; restart arthur run once no job runs, or pass --ignore-restart`;
	});
	host.provide("coordinator.context", () => {
		const state = restartDue(host.folder);
		if (state === undefined) return undefined;
		if (state.due.length === 0) return `Restart: none due; no commit changed Arthur's code ${since(state.loaded)}.`;
		return `Restart: due, ${state.due.join(", ")} changed Arthur's code ${since(state.loaded)}. Every spawn and continue is refused, unless --ignore-restart, until arthur run starts again (the service: systemctl --user restart arthur) once no job runs.`;
	});
}

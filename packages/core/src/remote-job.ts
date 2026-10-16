import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import type { Command } from "./commands.ts";
import { eventBus } from "./events.ts";
import { addWorktree, removeWorktree } from "./git.ts";
import type { Copy } from "./job-machine.ts";
import { writeRecord } from "./job-record.ts";
import { launch } from "./job-scope.ts";
import { field, ID } from "./job-state.ts";
import type { Job } from "./jobs.ts";
import { withLock } from "./lock.ts";

// `arthur remote-job`, the half of a job on another machine that runs there (spec/roadmap.md, entry 21), called over SSH by
// the main Arthur: docs/commands/remote-job.md. It needs no config there.

const USAGE = "usage: arthur remote-job repo|add|launch|remove|records <home> [args]";

// What `add` reads on stdin: the job with the repository there as its `root`, its prompt, and the record's other keys.
export type Added = { readonly job: Job; readonly prompt: string; readonly resumeOnBudget: boolean; readonly idleMinutes: number; readonly since: string };

const STEPS: Readonly<Record<string, (home: string, args: readonly string[]) => void | Promise<void>>> = {
	// Prints `present` when the repository of the project holds the commit, else `missing`, creating the repository bare.
	repo(home, [project = "", commit = ""]) {
		if (basename(project) !== project || project.startsWith(".")) throw new Error(`a project name, got ${JSON.stringify(project)}`);
		const root = join(home, "repos", `${project}.git`);
		// `git init` on a repository there already leaves it as it is.
		git(["init", "--quiet", "--bare", root]);
		console.log(spawnSync("git", ["-C", root, "cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" }).status === 0 ? "present" : "missing");
	},
	add(home) {
		const { job, prompt, resumeOnBudget, idleMinutes, since } = JSON.parse(readFileSync(0, "utf8")) as Added;
		addWorktree(job.root, job.worktree, job.base, job.branch);
		try {
			writeRecord(home, job, prompt, resumeOnBudget, idleMinutes, new Date(since));
		} catch (error) {
			removeWorktree(job.root, job.worktree, job.branch);
			throw error;
		}
	},
	// Prints why the wrapper did not start, which ended the job there; nothing once it started.
	async launch(home, [id = "", agent = "", slice = "", cpu = "", memory = ""]) {
		const read = record(home, id);
		const failed = await launch(home, { id, kind: read("kind"), project: read("project") }, agent, { slice, cpu: Number(cpu), memory }, eventBus(home));
		if (failed !== undefined) console.log(failed);
	},
	remove(home, [id = ""]) {
		const read = record(home, id);
		removeWorktree(read("root"), read("worktree"), read("branch") || undefined);
		rmSync(join(home, "jobs", id), { recursive: true, force: true });
	},
	// `<id>=<ms>` each: a JSON object of a `Copy` per job whose record exists.
	records(home, asked) {
		const answer: Record<string, Copy> = {};
		for (const pair of asked) {
			const [id = "", from = "0"] = pair.split("=");
			if (!ID.test(id) || !existsSync(join(home, "jobs", id, "kind"))) continue;
			const folder = join(home, "jobs", id);
			const read = field(home, id);
			// The state first, whole, so every file of its end is written by the time the files are read.
			const [state = "", reason = "", since = ""] = withLock(join(folder, "state.lock"), () => ["state", "reason", "since"].map(read));
			const files: Record<string, string> = {};
			let at = 0;
			for (const name of readdirSync(folder)) {
				const stat = statSync(join(folder, name));
				if (name.startsWith(".") || name.includes(".lock") || !stat.isFile()) continue;
				at = Math.max(at, stat.mtimeMs);
				if (stat.mtimeMs >= Number(from)) files[name] = read(name);
			}
			answer[id] = { state, reason, since, at, files };
		}
		console.log(JSON.stringify(answer));
	},
};

export function remoteJobCommand(): Command {
	return {
		name: "remote-job",
		doc: new URL("../docs/commands/remote-job.md", import.meta.url),
		async run({ args }) {
			const [step = "", home = "", ...rest] = args;
			const run = Object.hasOwn(STEPS, step) ? STEPS[step] : undefined;
			if (run === undefined || !isAbsolute(home)) {
				console.error(`arthur remote-job: ${run === undefined ? `unknown step ${JSON.stringify(step)}` : "the home folder must be an absolute path"}\n${USAGE}`);
				return 2;
			}
			await run(home, rest);
		},
	};
}

// A reader of the record of `id` there; refused when there is none.
function record(home: string, id: string): (name: string) => string {
	if (!ID.test(id) || !existsSync(join(home, "jobs", id, "kind"))) throw new Error(`${id}: no such job in ${join(home, "jobs")}`);
	return field(home, id);
}

function git(args: readonly string[]): void {
	const run = spawnSync("git", args, { encoding: "utf8" });
	if (run.status !== 0) throw new Error(`git ${args[0]}: ${run.error?.message ?? run.stderr.trim()}`);
}

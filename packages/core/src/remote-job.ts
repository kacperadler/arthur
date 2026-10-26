import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import type { Command } from "./commands.ts";
import { eventBus } from "./events.ts";
import { configRefusal } from "./git-config.ts";
import { addWorktree, removeWorktree } from "./git.ts";
import { insideJob } from "./inside-job.ts";
import { continueJob, steerJob, stopJob } from "./job-control.ts";
import { type Own, writeRecord } from "./job-record.ts";
import { jobCaps, jobEnv, launch, machineLimit, UNCAPPED } from "./job-scope.ts";
import { current, field, ID, inRun, told } from "./job-state.ts";
import type { Job } from "./jobs.ts";
import { withLock } from "./lock.ts";
import type { Copy } from "./machine-sync.ts";
import { ownHome } from "./own-home.ts";

// `arthur remote-job`, the half of a job on another machine that runs there (spec/roadmap.md, entries 21 and 22), called over
// SSH by the main Arthur: docs/commands/remote-job.md. It needs no config there: the jobs' slice there gets the machine's own
// limit, its cores minus one and 70% of its memory.

const USAGE = "usage: arthur remote-job repo|add|launch|stop|steer|continue|prune|remove|records <home> [args]";

// What `add` reads on stdin: the job with the repository there as its `root`, its prompt, and the record's other keys.
export type Added = { readonly job: Job; readonly prompt: string; readonly kind: Own; readonly idleMinutes: number; readonly since: string };

const STEPS: Readonly<Record<string, (home: string, args: readonly string[]) => void | Promise<void>>> = {
	// Prints `present` when the repository of the project holds the commit, else `missing`, creating the repository bare. Refused
	// while its config may name a program, which the push's `git receive-pack` here would run (`core.alternateRefsCommand`, AR0394).
	repo(home, [project = "", commit = ""]) {
		if (basename(project) !== project || project.startsWith(".")) throw new Error(`a project name, got ${JSON.stringify(project)}`);
		// The first step of a spawn there, so the home there is Arthur's user's alone before anything is written in it.
		ownHome(home);
		const root = join(home, "repos", `${project}.git`);
		// Created once: `git init` again writes `core.bare` back into the shared config, after a `prepare` may have moved it out.
		if (!existsSync(join(root, "HEAD"))) git(["init", "--quiet", "--bare", root]);
		const refusal = configRefusal(root);
		if (refusal !== "") throw new Error(`no push: ${refusal}`);
		console.log(spawnSync("git", ["-C", root, "cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" }).status === 0 ? "present" : "missing");
	},
	add(home) {
		const { job, prompt, kind, idleMinutes, since } = JSON.parse(readFileSync(0, "utf8")) as Added;
		addWorktree(job.root, job.worktree, job.base, job.branch);
		try {
			// Every project's repository there is `<home>/repos/<project>.git`, with its jobs' worktrees, in the home folder the guard refuses.
			writeRecord(home, job, prompt, kind, idleMinutes, new Date(since), "", undefined);
		} catch (error) {
			removeWorktree(job.root, job.worktree, job.branch);
			throw error;
		}
	},
	// Prints why the wrapper did not start, which ended the job there; nothing once it started; before that, `uncapped: <why>`
	// for a job with caps that runs bare here. Reads the job's variables on stdin, a JSON object (none when empty).
	async launch(home, [id = "", agent = "", slice = ""]) {
		const read = record(home, id);
		const env = jobEnv("core", JSON.parse(readFileSync(0, "utf8").trim() || "{}"));
		const failed = await launch(home, { id, kind: read("kind"), project: read("project") }, agent, { slice, ...machineLimit() }, eventBus(home), (why) => console.log(`${UNCAPPED}${why}`), env);
		if (failed !== undefined) console.log(failed);
	},
	// `stop`, `steer` and `continue` as here, on the record there: `arthur stop --help` and the others say what each refuses.
	async stop(home, [id = ""]) {
		console.log(await stopJob(home, id));
	},
	// Reads the text on stdin; prints the steer's number.
	steer(home, [id = ""]) {
		console.log(steerJob(home, id, readFileSync(0, "utf8")));
	},
	// Reads `{ instruction, env }` on stdin, `env` the variables the prepares returned on the main Arthur; `caps`, the caps in force
	// (JSON of what `jobs.limits` answered), replace the record's; prints why the wrapper did not start, as `launch`.
	async continue(home, [id = "", agent = "", slice = "", caps = "{}", budget]) {
		const { instruction, env } = JSON.parse(readFileSync(0, "utf8")) as { readonly instruction: string; readonly env?: unknown };
		const steps = { check: async () => ({ release: () => {}, caps: await jobCaps([JSON.parse(caps)]) }), prepare: async () => jobEnv("core", env) };
		const failed = await continueJob(home, id, instruction, budget === undefined ? undefined : Number(budget), agent, { slice, ...machineLimit() }, eventBus(home), (why) => console.log(`${UNCAPPED}${why}`), steps);
		if (failed !== undefined) console.log(failed);
	},
	// Removes the worktree, Git deciding, the branch when it is still at `tip`, the branch the main checkout holds, and the
	// record; prints what it did. A record gone already leaves nothing to do.
	prune(home, [id = "", tip = ""]) {
		if (!ID.test(id) || !existsSync(join(home, "jobs", id, "kind"))) return;
		const now = current(home, id);
		if (inRun(now)) throw new Error(`${id} is ${told(now)} there, in a run`);
		const [root, worktree, branch] = ["root", "worktree", "branch"].map(field(home, id)) as [string, string, string];
		const present = existsSync(worktree);
		// `git worktree remove` runs `git status` in the worktree, which runs a clean filter the shared config or the worktree's own names (AR0394).
		const refusal = present ? configRefusal(worktree) : "";
		if (refusal !== "") throw new Error(`git worktree: ${refusal}`);
		git(present ? ["worktree", "remove", worktree] : ["worktree", "prune"], root);
		const done = present ? [`worktree ${worktree} removed there`] : [];
		const deleted = tip !== "" && spawnSync("git", [...HOOKLESS, "update-ref", "-d", `refs/heads/${branch}`, tip], { cwd: root, stdio: "ignore" }).status === 0;
		if (branch !== "") done.push(deleted ? `branch ${branch} deleted there` : `kept branch ${branch} there: it is not the one here`);
		rmSync(join(home, "jobs", id), { recursive: true, force: true });
		console.log(done.join("; "));
	},
	remove(home, [id = ""]) {
		const read = record(home, id);
		removeWorktree(read("root"), read("worktree"), read("branch") || undefined);
		rmSync(join(home, "jobs", id), { recursive: true, force: true });
	},
	// `<id>=<ms>:<bytes>` each: a JSON object of a `Copy` per job whose record exists, its log from `<bytes>` on.
	records(home, asked) {
		const answer: Record<string, Copy> = {};
		for (const pair of asked) {
			const [id = "", from = "0", skip = "0"] = pair.split(/[=:]/);
			if (!ID.test(id) || !existsSync(join(home, "jobs", id, "kind"))) continue;
			const folder = join(home, "jobs", id);
			const read = field(home, id);
			// The state first, whole, so every file of its end is written by the time the files are read.
			const [state = "", reason = "", since = ""] = withLock(join(folder, "state.lock"), () => ["state", "reason", "since"].map(read));
			const files: Record<string, string> = {};
			let [at, logFrom, logSize] = [0, 0, 0];
			for (const name of readdirSync(folder)) {
				const stat = statSync(join(folder, name));
				if (name.startsWith(".") || name.includes(".lock") || !stat.isFile()) continue;
				at = Math.max(at, stat.mtimeMs);
				if (name === "log") logSize = stat.size;
				if (stat.mtimeMs < Number(from)) continue;
				if (name !== "log") files[name] = read(name);
				else {
					// Read once, so the next copy asks from the size this one sent.
					const bytes = readFileSync(join(folder, name));
					[logSize, logFrom] = [bytes.length, Number(skip) <= bytes.length ? Number(skip) : 0];
					files.log = bytes.subarray(logFrom).toString();
				}
			}
			answer[id] = { state, reason, since, at, logFrom, logSize, files };
		}
		console.log(JSON.stringify(answer));
	},
};

export function remoteJobCommand(): Command {
	return {
		name: "remote-job",
		doc: new URL("../docs/commands/remote-job.md", import.meta.url),
		// Inside a job only `records` runs (AR0353), which only reads the job records there.
		inJob: true,
		async run({ args }) {
			const [step = "", home = "", ...rest] = args;
			const run = Object.hasOwn(STEPS, step) ? STEPS[step] : undefined;
			if (run === undefined || !isAbsolute(home)) {
				console.error(`arthur remote-job: ${run === undefined ? `unknown step ${JSON.stringify(step)}` : "the home folder must be an absolute path"}\n${USAGE}`);
				return 2;
			}
			const job = insideJob(home);
			if (job !== undefined && step !== "records") {
				console.error(`arthur remote-job ${step}: refused inside a job ${job}: a job runs only the commands its role needs; put what the coordinator should do in your final message`);
				return 1;
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

// No hook or fsmonitor the repository's config names runs, nor a replacement (refs/replace): a program a job runs there may have set them (AR0382, AR0384).
const HOOKLESS = ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false"];

function git(args: readonly string[], cwd?: string): void {
	const run = spawnSync("git", [...HOOKLESS, ...args], { encoding: "utf8", cwd });
	if (run.status !== 0) throw new Error(`git ${args[0]}: ${run.error?.message ?? run.stderr.trim()}`);
}

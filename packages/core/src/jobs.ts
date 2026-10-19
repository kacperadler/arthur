import { rmSync } from "node:fs";
import { join } from "node:path";
import { taskTickets } from "./board-jobs.ts";
import type { Clock } from "./clock.ts";
import type { Bus } from "./events.ts";
import { addWorktree, branchExists, fileAt, head, removeWorktree } from "./git.ts";
import { checkout, checkouts } from "./job-checkout.ts";
import { type Limits, spawnLimits } from "./job-limits.ts";
import { continueJob } from "./job-control.ts";
import { addThere, LOCAL, type Machine, machineRegistry, type Ran, reach, removeThere, type Requires } from "./job-machine.ts";
import { type Kind, kindRegistry } from "./job-kinds.ts";
import { newJob, writeRecord } from "./job-record.ts";
import { type JobRecord, jobUpkeep } from "./job-records.ts";
import { launchThere, syncMachines } from "./machine-sync.ts";
import { pluginStep } from "./plugin.ts";
import { spawnChecks } from "./spawn-check.ts";
import { type Collect, describeRoles, prompt, type Role, type RoleReads, roleModel, roleReads, roleRegistry, type RoleView } from "./roles.ts";
import { type Caps, jobCaps, jobEnv, launch, type Slice, sayUncapped } from "./job-scope.ts";
import { pickModel } from "./job-model.ts";
import type { Board } from "./board.ts";
import { fileJob } from "./ticket-file.ts";

// The job runner's spawn and the job record (spec/roadmap.md, entries 9 and 11). A worker gets its own branch and worktree from
// HEAD, a read-only kind a detached checkout of HEAD; both live in `.arthur-worktrees/<id>` beside the repository, outside the main
// checkout and the home folder. The record is `<home>/jobs/<id>/`, one file per key, appearing whole; then the wrapper starts.

// `kind` defaults to `worker`, `project` to the main one; left undefined, `model` and `thinking` are the role's, a limit the kind's.
export type SpawnRequest = {
	readonly task: string;
	readonly kind?: string;
	readonly project?: string;
	readonly model?: string | readonly string[];
	readonly thinking?: string;
	readonly timeoutMinutes?: number;
	readonly budgetUsd?: number;
	// A registered machine; left out, the one a plugin's `jobs.place` answers, else `local`. `requires`: the labels it needs there.
	readonly machine?: string;
	readonly requires?: Requires;
	readonly ignoreRestart?: boolean;
};

// A spawn as `beforeSpawn` checks it: `tickets` holds every `Ticket:` file the task names, as written; `quick` is omp's `--smol`; `ignoreRestart` its `--ignore-restart` (session's restart guard); `modelWhy` why its model was picked (job-model.ts), `free` whether it costs nothing, its budget then 0.
export type Spawn = {
	readonly task: string;
	readonly kind: string;
	readonly project: string;
	readonly model: string | undefined;
	readonly modelWhy?: string;
	readonly thinking: string | undefined;
	readonly quick: string | undefined;
	readonly timeoutMinutes: number;
	readonly budgetUsd: number;
	readonly free: boolean;
	readonly tickets: readonly string[];
	readonly machine: string;
	readonly ignoreRestart: boolean;
};

// A job as `prepare` gets it; `base` is the commit it starts from, `branch` undefined for a read-only kind; its caps are what a plugin's `jobs.limits` answers.
export type Job = Spawn & Caps & { readonly id: string; readonly root: string; readonly base: string; readonly branch: string | undefined; readonly worktree: string };
// A job as `spawn` returns it: `warnings` are the prompt's; `failed` why its wrapper did not start, the job ended `failed`.
export type Started = Job & { readonly warnings: readonly string[]; readonly failed: string | undefined };

// A reason refuses the spawn; undefined lets it go on.
export type SpawnCheck = (spawn: Spawn) => string | undefined | Promise<string | undefined>;
export type Prepare = (job: Job, env: Readonly<Record<string, string>>, continued: boolean) => void | Readonly<Record<string, string>> | Promise<void | Readonly<Record<string, string>>>;

// What a plugin sees as `host.jobs`; what it reads of the roles outside a spawn (`prompt`, `vision`, `criteria`) is in roles.ts.
export type Jobs = RoleReads & {
	registerKind(kind: Kind): void;
	// A role whose prompt this plugin ships; its kinds name it.
	registerRole(role: Role): void;
	beforeSpawn(check: SpawnCheck): void;
	// After the worktree and the record exist, before the agent starts; a throw removes both and refuses the spawn; it runs here, on another machine through `run`. Variables it returns go into the job's environment only (job-scope.ts), never its record, and reach the prepares after it, in setup order, as `env`.
	// `arthur continue` runs it again on the job its record holds, `continued` true, for its variables only: a throw refuses the continue, and a step that sets up the worktree returns at once.
	prepare(fn: Prepare): void;
	// Machines jobs run on over SSH, `local` the core's; `run`: one command on one, `input` on its stdin; `machines`: every name (docs/commands/spawn.md).
	registerMachine(machine: Machine): void;
	run(machine: string, argv: readonly string[], limitSeconds?: number, input?: string): Promise<Ran>;
	machines(): string[];
	spawn(request: SpawnRequest): Promise<Started>;
	// Holds a job in a run `blocked` on `dependency: <reason>` until `unblock`; `stop`: stops it too, on `user: <reason>` (docs/commands/jobs.md).
	block(id: string, reason: string, stop?: boolean): Promise<unknown>;
	unblock(id: string): void;
	// Every project's job records, in any state, the newest spawn first (docs/commands/jobs.md).
	list(): JobRecord[];
	// The ids of `list()`'s jobs in a run (working, idle, or held), as `arthur stopall` counts them.
	running(): string[];
	// The final message of job `id`, empty while it runs or when it wrote none; refused for anything but a job's id.
	result(id: string): string;
	// `arthur ticket file <id> <job>`: job `job`, finished on ticket `id`, filed by its kind's `file`; the path written (ticket-file.ts).
	file(id: string, job: string): string;
};

// The runner of one load; `owner` is the plugin that registers, named in refusals. `prune` keeps a record a plugin's `jobs.keep` asks for.
export type JobRunner = ReturnType<typeof jobUpkeep> & Pick<Jobs, "spawn" | "run" | "machines" | "prompt" | "vision" | "criteria"> & {
	registerKind(owner: string, kind: Kind): void;
	registerRole(owner: string, role: Role): void;
	beforeSpawn(owner: string, check: SpawnCheck): void;
	prepare(owner: string, fn: Prepare): void;
	registerMachine(owner: string, machine: Machine): void;
	// `arthur continue`: resumes an ended job with a branch in place (job-control.ts), `budgetUsd` replacing its budget; resolves to why its wrapper did not start.
	continue(id: string, instruction: string, budgetUsd?: number, ignoreRestart?: boolean): Promise<string | undefined>;
	file(board: Board, id: string, job: string): string;
	// What `arthur roles` prints: each role, the files it reads in the project's main checkout, and its model.
	roles(project?: string): Promise<RoleView[]>;
};

// `folder` is in the repository jobs start from while no plugin provides `projects` (job-checkout.ts); `limits` are the core's `jobs` options
// and the jobs' slice, `agent` its `agent.command`; `collect` reads what the plugins provide, e.g. a prompt's sections and the project list.
export function jobRunner(home: string, folder: string, limits: Limits & Slice & { readonly idleMinutes: number; readonly offlineGraceMinutes: number }, agent: string, time: Clock, bus: Bus, collect: Collect): JobRunner {
	const [kinds, roles] = [kindRegistry(), roleRegistry()];
	const where = (project: string | undefined) => checkout(folder, collect("projects", []), project);
	const [checks, prepares] = [spawnChecks(home), [] as { readonly owner: string; readonly fn: Prepare }[]];
	const machines = machineRegistry(home);
	const upkeep = jobUpkeep(home, time, bus, (job) => collect("jobs.keep", [job]), machines.of);
	const prepared = async (job: Job, continued: boolean) => {
		const env: Record<string, string> = {};
		for (const { owner, fn } of prepares) Object.assign(env, jobEnv(owner, await pluginStep(owner, "prepare", () => fn(job, { ...env }, continued))));
		return env;
	};
	const runner: JobRunner = {
		...upkeep,
		...roleReads(roles, where),
		// Dead jobs here, then the copy from every other machine.
		sweep: () => void (upkeep.sweep(), syncMachines(home, machines.others(), bus, time.now(), limits.offlineGraceMinutes)),
		registerKind: (owner, kind) => kinds.register(owner, kind),
		registerRole: (owner, role) => roles.register(owner, role),
		beforeSpawn: (owner, check) => checks.add(owner, check),
		prepare: (owner, fn) => void prepares.push({ owner, fn }),
		registerMachine: (owner, machine) => machines.register(owner, machine),
		run: (machine, argv, limitSeconds, input) => machines.run(machine, argv, limitSeconds, input),
		machines: () => [LOCAL, ...machines.others().map((machine) => machine.name)],
		roles: (project) => describeRoles(roles, kinds.all(), where(project), collect),
		continue: (id, instruction, budgetUsd, ignoreRestart = false) =>
			continueJob(home, id, instruction, budgetUsd, agent, limits, bus, (why) => sayUncapped(home, LOCAL, why, bus), { check: async (job) => ({ caps: await jobCaps(collect("jobs.limits", [{ ...job, ignoreRestart }])), release: await checks.pass({ ...job, ignoreRestart }) }), prepare: (job) => prepared({ ...job, ignoreRestart }, true) }, machines.of(id)),
		file: (board, id, job) => fileJob(home, board, (name) => kinds.get(name)?.file, id, job),
		async spawn(request) {
			const name = request.kind ?? "worker";
			const kind = kinds.get(name);
			if (kind === undefined) throw new Error(`unknown kind ${name}; kinds: ${kinds.all().map((each) => each.name).sort().join(", ")}`);
			const role = roles.get(kind.role);
			if (request.task.trim() === "") throw new Error("the task is empty");
			const { root, project, files } = where(request.project);
			const commit = head(root);
			if (commit === undefined) throw new Error(`${root} has no commit yet; a job starts from HEAD`);
			if (!kind.readOnly && branchExists(root, "arthur")) throw new Error(`${root} has a branch named arthur, so Git cannot create a worker's branch arthur/<id> beside it; rename it: git branch -m arthur <new-name>`);
			const tickets = taskTickets(request.task);
			const missing = tickets.filter((path) => !fileAt(root, commit, path));
			if (missing.length > 0) throw new Error(`Ticket: ${missing.join(", ")}: no such file at HEAD (${commit.slice(0, 7)}); commit it first`);
			const preset = await roleModel(collect, role.name);
			const { task, model: wanted = preset.model, thinking = preset.thinking } = request;
			const { timeoutMinutes, budgetUsd } = spawnLimits(request, kind, limits);
			const asked = { task, kind: name, project, thinking, quick: preset.quick, timeoutMinutes, budgetUsd, tickets };
			const machine = await machines.pick(request.machine, request.requires, () => collect("jobs.place", [{ ...asked, model: wanted, machine: request.machine, requires: request.requires }]));
			const picked = await pickModel(collect, wanted, machine.name);
			const spawn: Spawn = { ...asked, ...picked, budgetUsd: picked.free ? 0 : budgetUsd, machine: machine.name, ignoreRestart: request.ignoreRestart === true };
			const caps = await jobCaps(collect("jobs.limits", [spawn]));
			const release = await checks.pass(spawn);
			try {
				// The project's repository on another machine, where every step after this one runs over SSH; undefined on `local`.
				const there = machine.name === LOCAL ? undefined : reach(machine, project, root, commit);
				const job = newJob(home, time.local().date, { ...spawn, ...caps }, root, commit, kind.readOnly, there ?? root);
				if (there === undefined) addWorktree(root, job.worktree, commit, job.branch);
				let [warnings, added, env] = [[] as string[], false, {} as Readonly<Record<string, string>>];
				try {
					// A worktree on another machine: the project's files the prompt reads come from the main checkout.
					const built = prompt(role, there === undefined ? job.worktree : root, files, () => collect("prompt", [role.name, job]));
					warnings = built.warnings;
					const [resumeOnBudget, since] = [kind.resumeOnBudget === true, time.now()];
					if (there !== undefined) addThere(machine, { job: { ...job, root: there }, prompt: built.prompt, resumeOnBudget, idleMinutes: limits.idleMinutes, since: since.toISOString() });
					added = true;
					writeRecord(home, job, built.prompt, resumeOnBudget, limits.idleMinutes, since, checkouts(collect("projects", [])));
					release();
					env = await prepared(job, false);
				} catch (error) {
					if (there === undefined) removeWorktree(root, job.worktree, job.branch);
					else if (added) removeThere(machine, job.id);
					rmSync(join(home, "jobs", job.id), { recursive: true, force: true });
					throw new Error(`${error instanceof Error ? error.message : String(error)}; the job's worktree and record were removed`);
				}
				bus.emit("core", "job-started", { id: job.id, kind: name, project, root, branch: job.branch, worktree: job.worktree, tickets, machine: machine.name });
				const failed = there === undefined ? await launch(home, job, agent, limits, bus, (why) => sayUncapped(home, LOCAL, why, bus), env) : launchThere(home, machine, job.id, agent, limits.slice, bus, env);
				return { ...job, warnings, failed };
			} finally {
				release();
			}
		},
	};
	runner.registerKind("core", { name: "worker", readOnly: false, role: "worker" });
	runner.registerRole("core", { name: "worker", file: new URL("../roles/worker.md", import.meta.url), criteria: ["styleguide"] });
	return runner;
}

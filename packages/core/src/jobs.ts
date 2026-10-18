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
import { kindRegistry } from "./job-kinds.ts";
import { newJob, writeRecord } from "./job-record.ts";
import { type JobRecord, jobUpkeep } from "./job-records.ts";
import { launchThere, syncMachines } from "./machine-sync.ts";
import { pluginStep } from "./plugin.ts";
import { spawnChecks } from "./spawn-check.ts";
import { type Collect, describeRoles, prompt, type Role, type RoleReads, roleModel, roleReads, roleRegistry, type RoleView } from "./roles.ts";
import { type Caps, jobCaps, launch, type Slice, sayUncapped } from "./job-scope.ts";
import type { Board } from "./board.ts";
import { type File, fileJob } from "./ticket-file.ts";

// The job runner's spawn and the job record (spec/roadmap.md, entries 9 and 11). A worker gets its own branch and worktree from
// HEAD, a read-only kind a detached checkout of HEAD; both live in `.arthur-worktrees/<id>` beside the repository, outside the main
// checkout and the home folder. The record is `<home>/jobs/<id>/`, one file per key, appearing whole; then the wrapper starts.

// A kind of job, owned by the plugin that registers it (job-kinds.ts); the core owns `worker`.
export type Kind = {
	readonly name: string;
	// No branch of its own: a detached checkout of HEAD.
	readonly readOnly: boolean;
	// The role whose prompt the job's agent gets; a plugin registers it with `registerRole`.
	readonly role: string;
	// Its own default limits, else the core's `jobs` options; `resumeOnBudget`: one resume at the budget, the budget doubled.
	readonly budgetUsd?: number;
	readonly timeoutMinutes?: number;
	readonly resumeOnBudget?: boolean;
	// How `arthur ticket file` files a finished job of this kind in its ticket's folder (ticket-file.ts); without it, nothing is filed.
	readonly file?: File;
};

// `kind` defaults to `worker`, `project` to the main one; left undefined, `model` and `thinking` are the role's, a limit the kind's.
export type SpawnRequest = {
	readonly task: string;
	readonly kind?: string;
	readonly project?: string;
	readonly model?: string;
	readonly thinking?: string;
	readonly timeoutMinutes?: number;
	readonly budgetUsd?: number;
	// A registered machine; left out, the one a plugin's `jobs.place` answers, else `local`. `requires`: the labels it needs there.
	readonly machine?: string;
	readonly requires?: Requires;
};

// A spawn as `beforeSpawn` checks it: `tickets` holds every `Ticket:` file the task names, as written; `quick` is omp's `--smol`.
export type Spawn = {
	readonly task: string;
	readonly kind: string;
	readonly project: string;
	readonly model: string | undefined;
	readonly thinking: string | undefined;
	readonly quick: string | undefined;
	readonly timeoutMinutes: number;
	readonly budgetUsd: number;
	readonly tickets: readonly string[];
	readonly machine: string;
};

// A job as `prepare` gets it; `base` is the commit it starts from, `branch` undefined for a read-only kind; its caps are what a plugin's `jobs.limits` answers.
export type Job = Spawn & Caps & { readonly id: string; readonly root: string; readonly base: string; readonly branch: string | undefined; readonly worktree: string };
// A job as `spawn` returns it: `warnings` are the prompt's; `failed` why its wrapper did not start, the job ended `failed`.
export type Started = Job & { readonly warnings: readonly string[]; readonly failed: string | undefined };

// A reason refuses the spawn; undefined lets it go on.
export type SpawnCheck = (spawn: Spawn) => string | undefined | Promise<string | undefined>;
export type Prepare = (job: Job) => void | Promise<void>;

// What a plugin sees as `host.jobs`; what it reads of the roles outside a spawn (`prompt`, `vision`) is in roles.ts.
export type Jobs = RoleReads & {
	registerKind(kind: Kind): void;
	// A role whose prompt this plugin ships; its kinds name it.
	registerRole(role: Role): void;
	beforeSpawn(check: SpawnCheck): void;
	// Runs after the worktree and the record exist and before the agent starts; a throw removes both and refuses the spawn. It
	// runs in this process: for a job on another machine (`job.machine`) it acts there through `run`.
	prepare(fn: Prepare): void;
	// A machine jobs may run on over SSH (job-machine.ts); `local` is the core's. `run`: one command on one (docs/commands/spawn.md).
	registerMachine(machine: Machine): void;
	run(machine: string, argv: readonly string[], limitSeconds?: number): Promise<Ran>;
	spawn(request: SpawnRequest): Promise<Started>;
	// Holds a job in a run `blocked` on `dependency: <reason>` whatever its activity; `unblock` lets it go (docs/commands/jobs.md).
	block(id: string, reason: string): void;
	unblock(id: string): void;
	// Every project's job records, in any state, the newest spawn first (docs/commands/jobs.md).
	list(): JobRecord[];
	// The ids of `list()`'s jobs in a run (working, idle, or held), as `arthur stopall` counts them.
	running(): string[];
	// The final message of job `id`, empty while it runs or when it wrote none; refused for anything but a job's id.
	result(id: string): string;
	// `arthur ticket file <id> <job>`: the final message of job `job`, finished on ticket `id`, filed by its kind's `file`, which
	// returns the path it wrote (ticket-file.ts).
	file(id: string, job: string): string;
};

// The runner of one load; `owner` is the plugin that registers, named in refusals. `prune` keeps a record a plugin's `jobs.keep` asks for.
export type JobRunner = ReturnType<typeof jobUpkeep> & Pick<Jobs, "spawn" | "run" | "prompt" | "vision"> & {
	registerKind(owner: string, kind: Kind): void;
	registerRole(owner: string, role: Role): void;
	beforeSpawn(owner: string, check: SpawnCheck): void;
	prepare(owner: string, fn: Prepare): void;
	registerMachine(owner: string, machine: Machine): void;
	// `arthur continue`: resumes an ended job with a branch in place (job-control.ts), `budgetUsd` replacing its budget; resolves to why its wrapper did not start.
	continue(id: string, instruction: string, budgetUsd?: number): Promise<string | undefined>;
	// `file` on the board `board`, which finds the ticket and its project.
	file(board: Board, id: string, job: string): string;
	// What `arthur roles` prints: each role, the files it reads in the project's main checkout, and its model.
	roles(project?: string): RoleView[];
};

// `folder` is in the repository jobs start from while no plugin provides `projects` (job-checkout.ts); `limits` are the core's
// `jobs` options and the jobs' slice, `agent` its `agent.command`; `collect` reads what the plugins provide, e.g. the sections
// of a prompt (`prompt`) and the project list (`projects`).
export function jobRunner(home: string, folder: string, limits: Limits & Slice & { readonly idleMinutes: number; readonly offlineGraceMinutes: number }, agent: string, time: Clock, bus: Bus, collect: Collect): JobRunner {
	const kinds = kindRegistry();
	const roles = roleRegistry();
	const where = (project: string | undefined) => checkout(folder, collect("projects", []), project);
	const checks = spawnChecks(home);
	const prepares: { readonly owner: string; readonly fn: Prepare }[] = [];
	const machines = machineRegistry(home);
	const upkeep = jobUpkeep(home, time, bus, (job) => collect("jobs.keep", [job]), machines.of);
	const runner: JobRunner = {
		...upkeep,
		...roleReads(roles, where),
		sweep() {
			// Dead jobs here, then the copy from every other machine.
			upkeep.sweep();
			syncMachines(home, machines.others(), bus, time.now(), limits.offlineGraceMinutes);
		},
		registerKind: (owner, kind) => kinds.register(owner, kind),
		registerRole: (owner, role) => roles.register(owner, role),
		beforeSpawn: (owner, check) => checks.add(owner, check),
		prepare: (owner, fn) => void prepares.push({ owner, fn }),
		registerMachine: (owner, machine) => machines.register(owner, machine),
		run: (machine, argv, limitSeconds) => machines.run(machine, argv, limitSeconds),
		roles: (project) => describeRoles(roles, kinds.all(), where(project), collect),
		continue: (id, instruction, budgetUsd) => continueJob(home, id, instruction, budgetUsd, agent, limits, bus, (why) => sayUncapped(home, LOCAL, why, bus), (spawn) => checks.pass({ ...spawn, tickets: taskTickets(spawn.task) }), machines.of(id)),
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
			const preset = roleModel(collect, role.name);
			const { task, model = preset.model, thinking = preset.thinking } = request;
			const { timeoutMinutes, budgetUsd } = spawnLimits(request, kind, limits);
			const asked = { task, kind: name, project, model, thinking, quick: preset.quick, timeoutMinutes, budgetUsd, tickets };
			const machine = await machines.pick(request.machine, request.requires, () => collect("jobs.place", [{ ...asked, machine: request.machine, requires: request.requires }]));
			const spawn: Spawn = { ...asked, machine: machine.name };
			const caps = await jobCaps(collect("jobs.limits", [spawn]));
			const release = await checks.pass(spawn);
			try {
				// The project's repository on another machine, where every step after this one runs over SSH; undefined on `local`.
				const there = machine.name === LOCAL ? undefined : reach(machine, project, root, commit);
				const job = newJob(home, time.local().date, { ...spawn, ...caps }, root, commit, kind.readOnly, there ?? root);
				if (there === undefined) addWorktree(root, job.worktree, commit, job.branch);
				let [warnings, added] = [[] as string[], false];
				try {
					// A worktree on another machine: the project's files the prompt reads come from the main checkout.
					const built = prompt(role, there === undefined ? job.worktree : root, files, () => collect("prompt", [role.name, job]));
					warnings = built.warnings;
					const [resumeOnBudget, since] = [kind.resumeOnBudget === true, time.now()];
					if (there !== undefined) addThere(machine, { job: { ...job, root: there }, prompt: built.prompt, resumeOnBudget, idleMinutes: limits.idleMinutes, since: since.toISOString() });
					added = true;
					writeRecord(home, job, built.prompt, resumeOnBudget, limits.idleMinutes, since, checkouts(collect("projects", [])));
					release();
					for (const { owner, fn } of prepares) await pluginStep(owner, "prepare", () => fn(job));
				} catch (error) {
					if (there === undefined) removeWorktree(root, job.worktree, job.branch);
					else if (added) removeThere(machine, job.id);
					rmSync(join(home, "jobs", job.id), { recursive: true, force: true });
					throw new Error(`${error instanceof Error ? error.message : String(error)}; the job's worktree and record were removed`);
				}
				bus.emit("core", "job-started", { id: job.id, kind: name, project, root, branch: job.branch, worktree: job.worktree, tickets, machine: machine.name });
				const failed = there === undefined ? await launch(home, job, agent, limits, bus, (why) => sayUncapped(home, LOCAL, why, bus)) : launchThere(home, machine, job.id, agent, limits.slice, bus);
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

import { rmSync } from "node:fs";
import { basename, join } from "node:path";
import { taskTickets } from "./board-jobs.ts";
import type { Clock } from "./clock.ts";
import type { Bus } from "./events.ts";
import { addWorktree, branchExists, fileAt, head, removeWorktree, topLevel } from "./git.ts";
import { checkLimits, type Limits, spawnLimits } from "./job-limits.ts";
import { continueJob } from "./job-control.ts";
import { addThere, launchThere, LOCAL, type Machine, machineRegistry, type Ran, reach, removeThere } from "./job-machine.ts";
import { newJob, writeRecord } from "./job-record.ts";
import { jobUpkeep } from "./job-records.ts";
import { pluginStep } from "./plugin.ts";
import { describeRoles, prompt, type Role, type RoleView, roleModel, roleRegistry } from "./roles.ts";
import { launch, type Slice } from "./job-scope.ts";

// The job runner's spawn and the job record (spec/roadmap.md, entries 9 and 11). A worker gets its own branch and worktree
// from HEAD, a read-only kind a detached checkout of HEAD; both live in `.arthur-worktrees/<id>` beside the repository,
// outside the main checkout and the home folder. The record is `<home>/jobs/<id>/`, one file per key, which appears whole;
// then the job's wrapper starts its agent in the background.

// A kind of job, owned by the plugin that registers it; the core owns `worker`.
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
	// A registered machine; left out, the one a plugin's `jobs.place` answers, else `local`.
	readonly machine?: string;
};

// A spawn as `beforeSpawn` checks it: every `Ticket:` file the task names is in `tickets`, as written.
export type Spawn = {
	readonly task: string;
	readonly kind: string;
	readonly project: string;
	readonly model: string | undefined;
	readonly thinking: string | undefined;
	readonly timeoutMinutes: number;
	readonly budgetUsd: number;
	readonly tickets: readonly string[];
	readonly machine: string;
};

// A job as `prepare` gets it; `base` is the commit it starts from, `branch` undefined for a read-only kind.
export type Job = Spawn & { readonly id: string; readonly root: string; readonly base: string; readonly branch: string | undefined; readonly worktree: string };
// A job as `spawn` returns it: `warnings` are the prompt's; `failed` why its wrapper did not start, the job ended `failed`.
export type Started = Job & { readonly warnings: readonly string[]; readonly failed: string | undefined };

// A reason refuses the spawn; undefined lets it go on.
export type SpawnCheck = (spawn: Spawn) => string | undefined | Promise<string | undefined>;
export type Prepare = (job: Job) => void | Promise<void>;

// What a plugin sees as `host.jobs`.
export type Jobs = {
	registerKind(kind: Kind): void;
	// A role whose prompt this plugin ships; its kinds name it.
	registerRole(role: Role): void;
	beforeSpawn(check: SpawnCheck): void;
	// Runs after the worktree and the record exist and before the agent starts; a throw removes both and refuses the spawn. It
	// runs in this process: for a job on another machine (`job.machine`) it acts there through `run`.
	prepare(fn: Prepare): void;
	// A machine jobs may run on over SSH (job-machine.ts); `local` is the core's. `run` runs one command on one (docs/commands/spawn.md).
	registerMachine(machine: Machine): void;
	run(machine: string, argv: readonly string[]): Promise<Ran>;
	spawn(request: SpawnRequest): Promise<Started>;
	// Holds a job in a run `blocked` on `dependency: <reason>` whatever its activity; `unblock` lets it go (docs/commands/jobs.md).
	block(id: string, reason: string): void;
	unblock(id: string): void;
};

// The runner of one load; `owner` is the plugin that registers, named in refusals. `prune` keeps a record a plugin's `jobs.keep` asks for.
export type JobRunner = ReturnType<typeof jobUpkeep> & Pick<Jobs, "spawn" | "run"> & {
	registerKind(owner: string, kind: Kind): void;
	registerRole(owner: string, role: Role): void;
	beforeSpawn(owner: string, check: SpawnCheck): void;
	prepare(owner: string, fn: Prepare): void;
	registerMachine(owner: string, machine: Machine): void;
	// `arthur continue`: resumes an ended job with a branch in place (job-control.ts) once the `beforeSpawn` checks pass on its
	// record, `budgetUsd` replacing its budget; resolves to why its wrapper did not start, as `failed` of a spawn.
	continue(id: string, instruction: string, budgetUsd?: number): Promise<string | undefined>;
	// What `arthur roles` prints: each role, the files it reads in the project's main checkout, and its model.
	roles(project?: string): RoleView[];
};

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

type Collect = (name: string, args: readonly unknown[]) => unknown[];

// `folder` is in the repository jobs start from; `limits` are the core's `jobs` options and the jobs' slice, `agent` its
// `agent.command`; `collect` reads what the plugins provide, e.g. the sections of a prompt (`prompt`).
export function jobRunner(home: string, folder: string, limits: Limits & Slice & { readonly idleMinutes: number }, agent: string, time: Clock, bus: Bus, collect: Collect): JobRunner {
	const kinds = new Map<string, { readonly owner: string; readonly kind: Kind }>();
	const roles = roleRegistry();
	const checks: { readonly owner: string; readonly check: SpawnCheck }[] = [];
	const prepares: { readonly owner: string; readonly fn: Prepare }[] = [];
	const machines = machineRegistry(home, bus);
	const upkeep = jobUpkeep(home, time, bus, (job) => collect("jobs.keep", [job]));
	const runner: JobRunner = {
		...upkeep,
		sweep() {
			// Dead jobs here, then the copy from every other machine.
			upkeep.sweep();
			machines.sync();
		},
		registerKind(owner, kind) {
			if (typeof kind.name !== "string" || !NAME.test(kind.name)) throw new Error(`kind ${JSON.stringify(kind.name)}: expected a name of lowercase letters, digits and dashes`);
			const first = kinds.get(kind.name);
			if (first) throw new Error(`kind ${kind.name}: registered by ${first.owner} and by ${owner}; a kind belongs to one plugin`);
			if (typeof kind.readOnly !== "boolean") throw new Error(`kind ${kind.name}: readOnly must be true or false`);
			checkLimits(`kind ${kind.name}`, kind);
			kinds.set(kind.name, { owner, kind });
		},
		registerRole: (owner, role) => roles.register(owner, role),
		beforeSpawn: (owner, check) => void checks.push({ owner, check }),
		prepare: (owner, fn) => void prepares.push({ owner, fn }),
		registerMachine: (owner, machine) => machines.register(owner, machine),
		run: (machine, argv) => machines.run(machine, argv),
		roles: (project) => describeRoles(roles, [...kinds.values()].map((entry) => entry.kind), checkout(project).root, collect),
		continue: (id, instruction, budgetUsd) => continueJob(home, id, instruction, budgetUsd, agent, limits, bus, (spawn) => checkSpawn({ ...spawn, tickets: taskTickets(spawn.task) })),
		async spawn(request) {
			const name = request.kind ?? "worker";
			const kind = kinds.get(name)?.kind;
			if (kind === undefined) throw new Error(`unknown kind ${name}; kinds: ${[...kinds.keys()].sort().join(", ")}`);
			const role = roles.get(kind.role);
			if (request.task.trim() === "") throw new Error("the task is empty");
			const { root, project } = checkout(request.project);
			const commit = head(root);
			if (commit === undefined) throw new Error(`${root} has no commit yet; a job starts from HEAD`);
			if (!kind.readOnly && branchExists(root, "arthur")) throw new Error(`${root} has a branch named arthur, so Git cannot create a worker's branch arthur/<id> beside it; rename it: git branch -m arthur <new-name>`);
			const tickets = taskTickets(request.task);
			const missing = tickets.filter((path) => !fileAt(root, commit, path));
			if (missing.length > 0) throw new Error(`Ticket: ${missing.join(", ")}: no such file at HEAD (${commit.slice(0, 7)}); commit it first`);
			const preset = roleModel(collect, role.name);
			const { task, model = preset.model, thinking = preset.thinking } = request;
			const { timeoutMinutes, budgetUsd } = spawnLimits(request, kind, limits);
			const asked = { task, kind: name, project, model, thinking, timeoutMinutes, budgetUsd, tickets };
			const machine = await machines.pick(request.machine, () => collect("jobs.place", [asked]));
			const spawn: Spawn = { ...asked, machine: machine.name };
			await checkSpawn(spawn);
			// The project's repository on another machine, where every step after this one runs over SSH; undefined on `local`.
			const there = machine.name === LOCAL ? undefined : reach(machine, project, root, commit);
			const job = newJob(home, time.local().date, spawn, root, commit, kind.readOnly, there ?? root);
			if (there === undefined) addWorktree(root, job.worktree, commit, job.branch);
			let [warnings, added] = [[] as string[], false];
			try {
				// A worktree on another machine: the project's files the prompt reads come from the main checkout.
				const built = prompt(role, there === undefined ? job.worktree : root, () => collect("prompt", [role.name, job]));
				warnings = built.warnings;
				const [resumeOnBudget, since] = [kind.resumeOnBudget === true, time.now()];
				if (there !== undefined) addThere(machine, { job: { ...job, root: there }, prompt: built.prompt, resumeOnBudget, idleMinutes: limits.idleMinutes, since: since.toISOString() });
				added = true;
				writeRecord(home, job, built.prompt, resumeOnBudget, limits.idleMinutes, since);
				for (const { owner, fn } of prepares) await pluginStep(owner, "prepare", () => fn(job));
			} catch (error) {
				if (there === undefined) removeWorktree(root, job.worktree, job.branch);
				else if (added) removeThere(machine, job.id);
				rmSync(join(home, "jobs", job.id), { recursive: true, force: true });
				throw new Error(`${error instanceof Error ? error.message : String(error)}; the job's worktree and record were removed`);
			}
			const { id, kind: kindName, branch, worktree } = job;
			bus.emit("core", "job-started", { id, kind: kindName, project, root, branch, worktree, tickets, machine: machine.name });
			const failed = there === undefined ? await launch(home, job, agent, limits, bus) : launchThere(home, machine, id, agent, limits, bus);
			return { ...job, warnings, failed };
		},
	};
	runner.registerKind("core", { name: "worker", readOnly: false, role: "worker" });
	runner.registerRole("core", { name: "worker", file: new URL("../roles/worker.md", import.meta.url), criteria: ["styleguide"] });
	return runner;

	async function checkSpawn(spawn: Spawn): Promise<void> {
		for (const { owner, check } of checks) {
			const reason = await pluginStep(owner, "beforeSpawn", () => check(spawn));
			if (reason !== undefined) throw new Error(`refused by ${owner}: ${reason}`);
		}
	}

	// The repository a job of `project` starts from, and the project's name: only the main one until a plugin adds projects.
	function checkout(project: string | undefined): { readonly root: string; readonly project: string } {
		const root = topLevel(folder);
		if (root === undefined) throw new Error(`${folder} is not in a Git repository; a job starts from its HEAD`);
		if (project !== undefined && project !== basename(root)) throw new Error(`unknown project ${project}; the only project is ${basename(root)}`);
		return { root, project: basename(root) };
	}
}

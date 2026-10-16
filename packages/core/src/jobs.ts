import { constants, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Clock } from "./clock.ts";
import type { Bus } from "./events.ts";
import { addWorktree, branchExists, fileAt, head, removeWorktree, topLevel } from "./git.ts";

// The job runner's spawn and the job record (spec/roadmap.md, entry 9). A worker gets its own branch and worktree from HEAD,
// a read-only kind a detached checkout of HEAD; both live in `.arthur-worktrees/<id>` beside the repository, outside the
// main checkout and the home folder. The record is `<home>/jobs/<id>/`, one file per key, which appears whole.

// A kind of job, owned by the plugin that registers it; the core owns `worker`.
export type Kind = {
	readonly name: string;
	// No branch of its own: a detached checkout of HEAD.
	readonly readOnly: boolean;
	// The role whose prompt the job's agent gets.
	readonly role: string;
	// Its own default limits; otherwise the core's `jobs.budgetUsd` and `jobs.timeoutMinutes`.
	readonly budgetUsd?: number;
	readonly timeoutMinutes?: number;
};

// `kind` defaults to `worker`, `project` to the main one; `model` and `thinking` undefined mean the agent's own default.
export type SpawnRequest = {
	readonly task: string;
	readonly kind?: string;
	readonly project?: string;
	readonly model?: string;
	readonly thinking?: string;
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
};

// A job as `prepare` gets it and `spawn` returns it; `branch` is undefined for a read-only kind.
export type Job = Spawn & { readonly id: string; readonly root: string; readonly branch: string | undefined; readonly worktree: string };

// A reason refuses the spawn; undefined lets it go on.
export type SpawnCheck = (spawn: Spawn) => string | undefined | Promise<string | undefined>;
export type Prepare = (job: Job) => void | Promise<void>;

// What a plugin sees as `host.jobs`.
export type Jobs = {
	registerKind(kind: Kind): void;
	beforeSpawn(check: SpawnCheck): void;
	// Runs after the worktree and the record exist and before the agent starts; a throw removes both and refuses the spawn.
	prepare(fn: Prepare): void;
	spawn(request: SpawnRequest): Promise<Job>;
};

// The runner of one load; `owner` is the plugin that registers, named in refusals.
export type JobRunner = {
	registerKind(owner: string, kind: Kind): void;
	beforeSpawn(owner: string, check: SpawnCheck): void;
	prepare(owner: string, fn: Prepare): void;
	spawn(request: SpawnRequest): Promise<Job>;
};

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
// `Ticket: <path>`, the path maybe in backticks; punctuation that ends the sentence is not part of it.
const TICKET = /\bTicket:\s*`?([^\s`]+)/g;
const LOCKFILE = "package-lock.json";

// `folder` is in the repository jobs start from; `limits` are the core's `jobs` options.
export function jobRunner(home: string, folder: string, limits: { readonly timeoutMinutes: number; readonly budgetUsd: number }, time: Clock, bus: Bus): JobRunner {
	const kinds = new Map<string, { readonly owner: string; readonly kind: Kind }>();
	const checks: { readonly owner: string; readonly check: SpawnCheck }[] = [];
	const prepares: { readonly owner: string; readonly fn: Prepare }[] = [];
	const runner: JobRunner = {
		registerKind(owner, kind) {
			if (typeof kind.name !== "string" || !NAME.test(kind.name)) throw new Error(`kind ${JSON.stringify(kind.name)}: expected a name of lowercase letters, digits and dashes`);
			const first = kinds.get(kind.name);
			if (first) throw new Error(`kind ${kind.name}: registered by ${first.owner} and by ${owner}; a kind belongs to one plugin`);
			if (typeof kind.readOnly !== "boolean") throw new Error(`kind ${kind.name}: readOnly must be true or false`);
			kinds.set(kind.name, { owner, kind });
		},
		beforeSpawn: (owner, check) => void checks.push({ owner, check }),
		prepare: (owner, fn) => void prepares.push({ owner, fn }),
		async spawn(request) {
			const name = request.kind ?? "worker";
			const kind = kinds.get(name)?.kind;
			if (kind === undefined) throw new Error(`unknown kind ${name}; kinds: ${[...kinds.keys()].sort().join(", ")}`);
			if (request.task.trim() === "") throw new Error("the task is empty");
			const root = repository(folder);
			const project = basename(root);
			if (request.project !== undefined && request.project !== project) throw new Error(`unknown project ${request.project}; the only project is ${project}`);
			const commit = head(root);
			if (commit === undefined) throw new Error(`${root} has no commit yet; a job starts from HEAD`);
			const tickets = [...new Set(Array.from(request.task.matchAll(TICKET), (match) => (match[1] ?? "").replace(/[.,;:!?)]+$/, "")))];
			const missing = tickets.filter((path) => !fileAt(root, commit, path));
			if (missing.length > 0) throw new Error(`Ticket: ${missing.join(", ")}: no such file at HEAD (${commit.slice(0, 7)}); commit it first`);
			const { task, model, thinking } = request;
			const timeoutMinutes = kind.timeoutMinutes ?? limits.timeoutMinutes;
			const spawn: Spawn = { task, kind: name, project, model, thinking, timeoutMinutes, budgetUsd: kind.budgetUsd ?? limits.budgetUsd, tickets };
			for (const { owner, check } of checks) {
				const reason = await step(owner, "beforeSpawn", () => check(spawn));
				if (reason !== undefined) throw new Error(`refused by ${owner}: ${reason}`);
			}
			const job = newJob(spawn, root, kind.readOnly);
			addWorktree(root, job.worktree, commit, job.branch);
			try {
				copyNodeModules(root, job.worktree);
				writeRecord(home, job);
				for (const { owner, fn } of prepares) await step(owner, "prepare", () => fn(job));
			} catch (error) {
				removeWorktree(root, job.worktree, job.branch);
				rmSync(join(home, "jobs", job.id), { recursive: true, force: true });
				throw new Error(`${error instanceof Error ? error.message : String(error)}; the job's worktree and record were removed`);
			}
			const { id, kind: kindName, branch, worktree } = job;
			bus.emit("core", "job-started", { id, kind: kindName, project, root, branch, worktree, tickets });
			return job;
		},
	};
	runner.registerKind("core", { name: "worker", readOnly: false, role: "worker" });
	return runner;

	// A free id, `<date>-<kind>-<8 hex digits>`: no record, worktree or branch of that name exists yet.
	function newJob(spawn: Spawn, root: string, readOnly: boolean): Job {
		for (;;) {
			const random = Buffer.from(crypto.getRandomValues(new Uint8Array(4))).toString("hex");
			const id = `${time.local().date}-${spawn.kind}-${random}`;
			const branch = readOnly ? undefined : `arthur/${id}`;
			const worktree = join(dirname(root), ".arthur-worktrees", id);
			if (existsSync(join(home, "jobs", id)) || existsSync(worktree) || (branch !== undefined && branchExists(root, branch))) continue;
			return { ...spawn, id, root, branch, worktree };
		}
	}
}

function repository(folder: string): string {
	try {
		return topLevel(folder);
	} catch {
		throw new Error(`${folder} is not in a Git repository; a job starts from its HEAD`);
	}
}

// A plugin's hook that throws refuses the spawn, named by the plugin.
async function step<T>(owner: string, name: string, run: () => T | Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		throw new Error(`plugin ${owner}: ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
	}
}

// The main checkout's `node_modules`, when its lockfile is the job's byte for byte; a copy-on-write clone where the
// filesystem has one. Links stay as they are, so a workspace's link points into the job's own worktree.
function copyNodeModules(root: string, worktree: string): void {
	const modules = join(root, "node_modules");
	const ours = join(root, LOCKFILE);
	const theirs = join(worktree, LOCKFILE);
	if (!existsSync(modules) || !existsSync(ours) || !existsSync(theirs) || !readFileSync(ours).equals(readFileSync(theirs))) return;
	cpSync(modules, join(worktree, "node_modules"), { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE });
}

// Written into `.<id>` and renamed, so a reader sees all of it or nothing. An empty `branch`, `model` or `thinking` is none.
function writeRecord(home: string, job: Job): void {
	const folder = join(home, "jobs");
	const temporary = join(folder, `.${job.id}`);
	mkdirSync(temporary, { recursive: true });
	const record = {
		task: job.task,
		kind: job.kind,
		model: job.model ?? "",
		thinking: job.thinking ?? "",
		timeout: String(job.timeoutMinutes),
		budget: String(job.budgetUsd),
		branch: job.branch ?? "",
		root: job.root,
		worktree: job.worktree,
		project: job.project,
	};
	for (const [name, value] of Object.entries(record)) writeFileSync(join(temporary, name), value);
	renameSync(temporary, join(folder, job.id));
}

import type { Cleanup } from "./job-cleanup.ts";
import type { Kind } from "./job-kinds.ts";
import type { Machine, Ran } from "./job-machine.ts";
import type { JobRecord } from "./job-records.ts";
import type { Prepare, SpawnCheck, SpawnRequest, Started } from "./jobs.ts";
import type { Role, RoleReads } from "./roles.ts";

// What a plugin sees as `host.jobs`; what it reads of the roles outside a spawn (`prompt`, `vision`, `criteria`) is in roles.ts.
export type Jobs = RoleReads & {
	registerKind(kind: Kind): void;
	// A role whose prompt this plugin ships; its kinds name it.
	registerRole(role: Role): void;
	// An OMP extension, its module's `file:` URL, that each job's agent loads with `-e` after the core's own, in the order registered.
	registerExtension(url: URL): void;
	beforeSpawn(check: SpawnCheck): void;
	// After the worktree and the record exist, before the agent starts; a throw removes both and refuses the spawn; it runs here, on another machine through `run`. Variables it returns go into the job's environment only (job-scope.ts), never its record, and reach the prepares after it, in setup order, as `env`. `arthur continue` runs it again on the job its record holds, `continued` true, for its variables only: a throw refuses the continue, and a step that sets up the worktree returns at once.
	prepare(fn: Prepare): void;
	// Run inside `prune`, after every check that keeps everything, right before the job's worktree goes, here or through `arthur remote-job prune` there; one hook at a time in setup order, 2 minutes each, again on each later prune of the job. A throw, a rejection or the limit is one notice and never keeps the worktree; a returned text joins the job's prune line as `<plugin>: <text>` (docs/commands/prune.md).
	cleanup(fn: Cleanup): void;
	// Machines jobs run on over SSH, `local` the core's; `run`: one command on one, `input` on its stdin; `machines`: every name; `home`: Arthur's home folder on one (docs/commands/spawn.md); `slice`: the jobs' systemd slice without `.slice`, `arthur-jobs` or the one `ARTHUR_JOB_SLICE` names (host.ts), a test kit's own under the fake host.
	registerMachine(machine: Machine): void;
	run(machine: string, argv: readonly string[], limitSeconds?: number, input?: string): Promise<Ran>;
	machines(): string[];
	home(machine: string): string;
	readonly slice: string;
	spawn(request: SpawnRequest): Promise<Started>;
	// `arthur continue` of an ended job with a branch, `budgetUsd` replacing its budget, `decision` as its `--decision` (AR0355); resolves to why its wrapper did not start (job-control.ts).
	continue(id: string, instruction: string, budgetUsd?: number, decision?: string): Promise<string | undefined>;
	// Holds a job in a run `blocked` on `dependency: <reason>` until its run ends; `stop`: stops it too, on `user: <reason>` (docs/commands/jobs.md).
	block(id: string, reason: string, stop?: boolean): Promise<unknown>;
	// `list`: every project's job records, in any state, the newest spawn first; `running`: the ids of those in a run (working, idle, or held), as `arthur stopall` counts them; `prune`: `arthur prune <id>...`, one line per job, the jobs one after another (docs/commands/jobs.md, prune.md).
	list(): JobRecord[];
	running(): string[];
	prune(ids: readonly string[]): Promise<string[]>;
	// The final message of job `id`, empty while it runs or when it wrote none; refused for anything but a job's id.
	result(id: string): string;
	// `arthur ticket file [<id>] <job>`: job `job`, finished on ticket `id` or, undefined, on none, filed by its kind's `file`; the path written (ticket-file.ts).
	file(id: string | undefined, job: string): string;
};

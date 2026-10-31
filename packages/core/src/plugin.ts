import type { Board } from "./board.ts";
import type { Clock } from "./clock.ts";
import type { Commands } from "./commands.ts";
import type { LoadedConfig } from "./config.ts";
import type { Events } from "./events.ts";
import type { Jobs } from "./jobs.ts";

// The plugin shape and the host one plugin sees (spec/roadmap.md, entries 4 and 51), `@arthur/core/plugin`: docs/plugin-api.md.
// A plugin is a function from its options to a `Plugin`; the config's plugin list holds what those functions return. The host
// itself is plugin-host.ts. A change here is a decision recorded in its ticket.

// The types a plugin meets through the host, by name.
export type { Command, CommandInput, PhoneFrom } from "./commands.ts";
export type { Event } from "./event-log.ts";
export type { Kind } from "./job-kinds.ts";
export type { Machine, Ran, Requires } from "./job-machine.ts";
export type { JobRecord } from "./job-records.ts";
export type { Job, Prepare, Spawn, SpawnCheck, SpawnRequest, Started } from "./jobs.ts";
export type { Role } from "./roles.ts";
export type { Filing } from "./ticket-file.ts";
export type { Project, Ticket } from "./board.ts";

export type Options = Readonly<Record<string, unknown>>;

// One wrong option: `path` from the plugin's options, e.g. `instances[1].url`; `problem` says what was expected.
export type OptionProblem = { readonly path: string; readonly problem: string };

// Any function: a provider's arguments are whatever its callers pass.
export type Provider = (...args: never[]) => unknown;

// One thing a plugin needs to work (spec/roadmap.md, entry 80), in a list: its `doctor` gives those it checks from its options
// alone, `provide("doctor", ...)` those that need its setup. `check` answers `ok`, `ok (<detail>)` or `missing: <reason>`;
// `fix` is read after it, so it may name that reason's fix.
export type Requirement = { readonly name: string; check(): string | Promise<string>; readonly costs: string; readonly fix: string; readonly critical?: boolean };

export type Plugin = {
	readonly name: string;
	// Its own module's URL, `import.meta.url`: the host's `code` holds the package folder around it.
	readonly module?: string;
	// As written in the config. `enabled: false` means the host neither loads the plugin nor reads its env variables.
	readonly options?: Options;
	// The plugins this one needs; each must be in the list and enabled, and its `setup` runs first.
	readonly requires?: readonly string[];
	// The plugins whose `setup` runs first when they are loaded; one missing or disabled is no refusal.
	readonly after?: readonly string[];
	// Its own options, `enabled` left out, and the core's as loaded (its defaults applied); every problem refuses the start.
	readonly check?: (options: Options, core: LoadedConfig["core"]) => readonly OptionProblem[];
	// Its requirements read from the same, without its setup or its env values, so `arthur doctor` and `arthur setup` check them
	// even while the load refuses (a variable missing).
	readonly doctor?: (options: Options, core: LoadedConfig["core"]) => readonly Requirement[] | Promise<readonly Requirement[]>;
	// Its check of one project's piece, what its `<name>.project(...)` helper made in that project's file (`pieces[<name>]` of
	// `projects`), with its own options: a problem, or undefined. Having it declares the piece: the host runs it on every
	// project's piece before `setup`, and `arthur doctor` names a piece no loaded plugin declares.
	readonly piece?: (value: unknown, options: Options) => string | undefined;
	readonly setup: (host: Host) => void | Promise<void>;
	readonly start?: () => void | Promise<void>;
	readonly stop?: () => void | Promise<void>;
};

export type Host = {
	readonly name: string;
	readonly options: Options;
	// The plugin's own `...Env` variables that are set, by variable name; `secrets`, every enabled plugin's set values, for redaction.
	readonly env: Readonly<Record<string, string>>;
	readonly secrets: readonly string[];
	// `<home>/<plugin>/`, created before `setup`; no other plugin reads or writes it. Inside a job's sandbox it cannot be read (job-sandbox.ts).
	readonly folder: string;
	// One clock for every plugin, in the core's `timeZone` with its `quietHours`.
	readonly clock: Clock;
	// The core's `agent.command`, the agent a plugin starts outside a job (orchestration's coordinator).
	readonly agent: string;
	// Inside a job (inside-job.ts): its id and its record's `project`, "" when this home holds no record of it; undefined outside one.
	readonly job?: { readonly id: string; readonly project: string };
	// The sandbox of branch code a plugin runs outside a job, as a job's install runs in (delivery's checks on main): a function
	// from a shell command to the command and arguments that run it by `sh -c` writing only in the checkout `folder` (each
	// entry but `.git`, Arthur's home, config and env file; of `.git` its objects, refs, logs and index), the folder `cache`,
	// made if missing, where the package managers' caches go (the plugin's own, which it removes), the temporary folder and
	// `/dev`, reading every file but the env file and `~/.ssh`, and no other process's environment; where it cannot be set up, `note` gets
	// one line, `no sandbox: <why>; each step writes wherever Arthur's user can`, and it runs bare, its caches in `cache` still.
	sandbox(folder: string, cache: string, note: (line: string) => void): (command: string) => [string, string[]];
	// The package folders this load runs, the core's, then each enabled plugin's around its `module` if any (the session plugin's restart guard watches their `src/`); `package`, this plugin's own.
	readonly code: readonly string[];
	readonly package?: string;
	// Events go to every subscriber in this process and to the log `<home>/events.jsonl`, named by this plugin.
	readonly events: Events;
	// Several plugins may provide one name: `call` needs exactly one, `collect` reads them all, in setup order; `collectEach` too, each answer with its plugin, a throw costing that answer only (`error`).
	provide(name: string, fn: Provider): void;
	call<T = unknown>(name: string, ...args: readonly unknown[]): T;
	collect<T = unknown>(name: string, ...args: readonly unknown[]): T[];
	collectEach<T = unknown>(name: string, ...args: readonly unknown[]): Answer<T>[];
	// The command registry: `register` this plugin's commands; `route` and `phone` for a channel.
	readonly commands: Commands;
	// The job runner: this plugin's kinds and roles, its checks before a spawn, its steps for a new worktree (on another machine
	// through `run`, a command there), its machines, spawns and holds. `setup`
	// registers; a `spawn` before every plugin's `setup` has run, and the core follows the jobs, throws and creates nothing.
	readonly jobs: Jobs;
	// The ticket board of every project in the list a plugin provides as `projects`; its events are named by this plugin. A
	// ticket waits for others only through `arthur ticket after`, the core's.
	readonly board: Omit<Board, "after">;
};

export type Answer<T> = { readonly plugin: string; readonly value: T } | { readonly plugin: string; readonly error: Error };

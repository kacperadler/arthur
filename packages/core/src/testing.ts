import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { board } from "./board.ts";
import { moveStartedTickets, refuseUnstartableTickets } from "./board-jobs.ts";
import { clock } from "./clock.ts";
import { type Command, commandRegistry } from "./commands.ts";
import type { QuietHours } from "./config.ts";
import type { Event } from "./event-log.ts";
import { eventBus } from "./events.ts";
import type { Slice } from "./job-scope.ts";
import type { Kind } from "./job-kinds.ts";
import { jobRunner } from "./jobs.ts";
import type { Role } from "./roles.ts";
import type { Host, Options, Plugin, Provider, SpawnCheck } from "./plugin.ts";
import { pluginHost, registry } from "./plugin-host.ts";

// The test kit (spec/roadmap.md, entries 4, 11 and 13), `@arthur/core/testing`, which `npm test` loads into every test process
// (`--import`) as the safety net: every `ARTHUR_` variable and tmux's session variables are cleared and tmux's default socket
// moves into a temporary folder, so no test reaches a live bot, token or tmux server; `omp` on `PATH` is the fake agent with
// no run (it fails), so no job reaches the real agent; every folder the kit makes, and its slice `jobSlice`, go at exit.

for (const key of Object.keys(process.env)) if (key.startsWith("ARTHUR_") || key === "TMUX" || key === "TMUX_PANE") delete process.env[key];
const root = mkdtempSync(join(tmpdir(), "arthur-test-"));
process.env.TMUX_TMPDIR = root;

// The joint slice of a test's jobs, never Arthur's own: `arthur_test_<8 hex digits>.slice` right under the user manager (a `-`
// would nest it in another slice); at exit it is stopped, with any job still in it, and its limits are removed.
export const jobSlice: Slice = { slice: `arthur_test_${randomBytes(4).toString("hex")}`, cpu: 2, memory: "2G" };

process.on("exit", () => {
	for (const verb of ["stop", "revert"]) spawnSync("systemctl", ["--user", verb, `${jobSlice.slice}.slice`], { stdio: "ignore" });
	rmSync(root, { recursive: true, force: true });
});
process.env.PATH = [dirname(fakeAgent({ steps: [{ stderr: "fake agent: this test scripted no run" }], exitCode: 1 })), process.env.PATH].join(delimiter);

// A new empty folder of the kit's, e.g. a test's home folder instead of a live `.arthur/`.
export function temporaryFolder(): string {
	return mkdtempSync(join(root, "folder-"));
}

// A scripted run of the fake agent: its `steps`, played in order, then its `exitCode` (default 0); its extensions' first `failSends` messages throw, the next `dropSends` sent while idle
// are lost with no turn (omp's prompt failing after it returned), and `ctx.compact` throws `compactError`; with `clock`, a file, `Date.now()` in the agent and its extensions answers the
// time in ms it holds while it exists, so a test moves time. A step: `tool`, a tool call, omp's start and end events of it, `output` the tool's text and `failed` its error flag.
// `message`: an assistant message that ends a turn, with its `cost` in USD; `stopReason` `stop` (the default) ends the run, `toolUse` comes before a tool call, `error` or `aborted` a
// failed one, with omp's `error` text. `prompt`: a turn starts (`agent_start`) once an extension sent a message while idle, busy `compactMs` first (omp's compaction before it), after its
// `before_agent_start` handlers; `end`: it ends (`agent_end`) unless a `session_stop` handler continues it (8 in a row at most) or, with `continues`, says it goes on and starts none
// (omp's compaction after it). `stdout`/`stderr`: one line. `waitFor`: until the file exists. `signal`: kills itself with it.
export type AgentStep =
	| { readonly tool: string; readonly args?: Readonly<Record<string, unknown>>; readonly output?: string; readonly failed?: boolean }
	| { readonly message: string; readonly cost?: number; readonly stopReason?: "stop" | "toolUse" | "error" | "aborted"; readonly error?: string }
	| { readonly prompt: true; readonly compactMs?: number }
	| { readonly end: true; readonly continues?: true }
	| { readonly stdout: string }
	| { readonly stderr: string }
	| { readonly waitFor: string }
	| { readonly signal: NodeJS.Signals };

export type AgentRun = { readonly steps: readonly AgentStep[]; readonly exitCode?: number; readonly failSends?: number; readonly dropSends?: number; readonly compactError?: string; readonly clock?: string };

// The fake agent: an executable `omp` in a new folder of the kit's, which plays `run` each time it starts, notes each start
// (`pid`, `cwd`, `args`) in `starts.jsonl` beside it once its `-e` extensions are loaded, each message they send (`content`, `options`, `step`) in
// `messages.jsonl`, their `ctx.ui` calls in `ui.jsonl`, their `ctx.compact` calls in `compactions.jsonl`, and each turn's system prompt in `system.jsonl`. Returns its path, for `PATH` or as `core.agent.command`.
export function fakeAgent(run: AgentRun): string {
	const folder = temporaryFolder();
	const quote = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`;
	const player = [process.execPath, join(import.meta.dirname, "fake-agent.ts"), join(folder, "run.json")].map(quote).join(" ");
	writeFileSync(join(folder, "run.json"), JSON.stringify(run));
	writeFileSync(join(folder, "omp"), `#!/bin/sh\nexec ${player} "$@"\n`, { mode: 0o755 });
	return join(folder, "omp");
}

// One `call` or `collect` the plugin made.
type Use = { readonly kind: "call" | "collect"; readonly name: string; readonly args: readonly unknown[] };

export type FakeHost = {
	// Given to the plugin's `setup`, which `setup(plugin)` runs: a spawn during it throws, as in a real load.
	readonly host: Host;
	setup(plugin: Pick<Plugin, "setup">): Promise<void>;
	// What the plugin did through `host`, in order.
	readonly provided: readonly string[];
	readonly calls: readonly Use[];
	// The commands it registered, in order; `host.commands.route` answers a channel's `/name text` with them.
	readonly commands: readonly Command[];
	// The kinds of job and the roles it registered, in order; `host.jobs.spawn` runs its checks and steps on a real worktree of
	// `root` and builds the role's prompt there, with the sections the test provides as `prompt`; `host.jobs.continue` is `arthur continue`.
	readonly kinds: readonly Kind[];
	readonly roles: readonly Role[];
	// The events the plugin emitted, as logged, in the order of their sequence numbers.
	readonly emitted: readonly Event[];
	// The test as another plugin, `test`: drives what the plugin provides, provides what it calls, or refuses a spawn.
	call<T = unknown>(name: string, ...args: readonly unknown[]): T;
	collect<T = unknown>(name: string, ...args: readonly unknown[]): T[];
	provide(name: string, fn: Provider): void;
	beforeSpawn(check: SpawnCheck): void;
	// An event from the plugin `test`, delivered to the plugin's subscribers and logged like any other.
	emit(name: string, data: unknown): Event;
	// Moves the host's clock to `at`, where it stays until the next call.
	setNow(at: Date): void;
};

// The host one plugin sees, alone: its options as given (`enabled` is the host's, left out), its env values, and its folder,
// `<temporary folder>/<name>/`, whose parent is the home folder holding the event log and the job records. A `call` or a
// command's registration refuses like the real host's, naming the plugin. Its clock stands still at `now` (default
// 2026-01-01T00:00:00Z) in `timeZone` (default UTC) until `setNow` moves it. `host.board` reads the project list the test
// provides as `projects`. `host.jobs.spawn` starts from HEAD of the project's folder in that list, else of the repository
// `root` (a test's own), with the core's default limits, in the kit's `jobSlice`, and runs the agent `omp` that `PATH` finds, as `host.agent` names it.
// `host.code` is `code`, default none: the package folders a test's restart guard watches, in a repository of its own.
// As in a real load, the core follows the jobs after `setup`: at the first spawn, its `beforeSpawn` joins after the plugin's
// checks and refuses a worker on a ticket of that list that cannot move to in-progress, and its move joins after the plugin's
// `job-started` handlers, which still see the ticket `planned`. A plugin must not rely on that: a `job-started` from another
// process (`arthur spawn`, which the daemon follows) reaches its handler after the move.
export function fakeHost(plugin: {
	readonly name: string;
	readonly options?: Options;
	readonly env?: Readonly<Record<string, string>>;
	readonly timeZone?: string;
	readonly quietHours?: QuietHours;
	readonly now?: Date;
	readonly root?: string;
	readonly code?: readonly string[];
}): FakeHost {
	const names = registry();
	const registered = commandRegistry();
	const home = temporaryFolder();
	const bus = eventBus(home);
	const folder = join(home, plugin.name);
	mkdirSync(folder);
	let now = (plugin.now ?? new Date("2026-01-01T00:00:00Z")).getTime();
	const time = clock(plugin.timeZone ?? "UTC", plugin.quietHours, () => new Date(now));
	const jobs = jobRunner(home, plugin.root ?? home, { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, "omp", time, bus, names.collect);
	let loading = false, following = false;
	const real = pluginHost(names, registered, bus, jobs, { name: plugin.name, options: plugin.options ?? {}, env: plugin.env ?? {}, folder, clock: time, agent: "omp", code: plugin.code ?? [], package: undefined }, () => loading);
	const core = board(() => names.collect("projects", []), time, (name, data) => bus.emit("core", name, data));
	const [provided, calls, commands, kinds, roles] = [[] as string[], [] as Use[], [] as Command[], [] as Kind[], [] as Role[]];
	const host: Host = {
		...real,
		provide(name, fn) {
			provided.push(name);
			real.provide(name, fn);
		},
		call: <T>(name: string, ...args: readonly unknown[]) => {
			calls.push({ kind: "call", name, args });
			return real.call<T>(name, ...args);
		},
		collect: <T>(name: string, ...args: readonly unknown[]) => {
			calls.push({ kind: "collect", name, args });
			return real.collect<T>(name, ...args);
		},
		commands: {
			...real.commands,
			register(command) {
				real.commands.register(command);
				commands.push(command);
			},
		},
		jobs: {
			...real.jobs,
			registerKind(kind) {
				real.jobs.registerKind(kind);
				kinds.push(kind);
			},
			registerRole(role) {
				real.jobs.registerRole(role);
				roles.push(role);
			},
			spawn(request) {
				if (!following && !loading) {
					refuseUnstartableTickets(core, jobs);
					moveStartedTickets(core, bus);
					following = true;
				}
				return real.jobs.spawn(request);
			},
		},
	};
	return {
		host,
		setup(plugin) {
			loading = true;
			return Promise.try(() => plugin.setup(host)).finally(() => (loading = false));
		},
		provided,
		calls,
		commands,
		kinds,
		roles,
		get emitted() {
			return bus.read(1).filter((event) => event.plugin === plugin.name);
		},
		call: <T>(name: string, ...args: readonly unknown[]) => names.call("test", name, args) as T,
		collect: <T>(name: string, ...args: readonly unknown[]) => names.collect(name, args) as T[],
		provide: (name, fn) => names.provide("test", name, fn),
		beforeSpawn: (check) => jobs.beforeSpawn("test", check),
		emit: (name, data) => bus.emit("test", name, data),
		setNow: (at) => void (now = at.getTime()),
	};
}

import { type Board, board } from "./board.ts";
import type { Clock } from "./clock.ts";
import type { CommandRegistry, Commands } from "./commands.ts";
import { describe } from "./config.ts";
import type { Bus, Events } from "./events.ts";
import type { JobRunner, Jobs } from "./jobs.ts";

// The plugin shape and the host one plugin sees (spec/roadmap.md, entry 4). A plugin is a function from its options to a
// `Plugin`; the config's plugin list holds what those functions return. Names are proposals until entry 51 fixes them.

export type Options = Readonly<Record<string, unknown>>;

// One wrong option: `path` from the plugin's options, e.g. `instances[1].url`; `problem` says what was expected.
export type OptionProblem = { readonly path: string; readonly problem: string };

// Any function: a provider's arguments are whatever its callers pass.
export type Provider = (...args: never[]) => unknown;

export type Plugin = {
	readonly name: string;
	// As written in the config. `enabled: false` means the host neither loads the plugin nor reads its env variables.
	readonly options?: Options;
	// The plugins this one needs; each must be in the list and enabled, and its `setup` runs first.
	readonly requires?: readonly string[];
	// Its own options, `enabled` left out; every problem refuses the start.
	readonly check?: (options: Options) => readonly OptionProblem[];
	readonly setup: (host: Host) => void | Promise<void>;
	readonly start?: () => void | Promise<void>;
	readonly stop?: () => void | Promise<void>;
};

export type Host = {
	readonly name: string;
	readonly options: Options;
	// The plugin's own `...Env` variables that are set, by variable name.
	readonly env: Readonly<Record<string, string>>;
	// `<home>/<plugin>/`, created before `setup`; no other plugin reads or writes it.
	readonly folder: string;
	// One clock for every plugin, in the core's `timeZone` with its `quietHours`.
	readonly clock: Clock;
	// The core's `agent.command`, the agent a plugin starts outside a job (orchestration's coordinator).
	readonly agent: string;
	// Events go to every subscriber in this process and to the log `<home>/events.jsonl`, named by this plugin.
	readonly events: Events;
	// Several plugins may provide one name: `call` needs exactly one, `collect` reads them all, in setup order.
	provide(name: string, fn: Provider): void;
	call<T = unknown>(name: string, ...args: readonly unknown[]): T;
	collect<T = unknown>(name: string, ...args: readonly unknown[]): T[];
	// The command registry: `register` this plugin's commands; `route` and `phone` for a channel.
	readonly commands: Commands;
	// The job runner: this plugin's kinds and roles, its checks before a spawn, its steps for a new worktree (on another machine
	// through `run`, a command there), its machines, spawns and holds. `setup`
	// registers; a `spawn` before every plugin's `setup` has run, and the core follows the jobs, throws and creates nothing.
	readonly jobs: Jobs;
	// The ticket board of every project in the list a plugin provides as `projects`; its events are named by this plugin.
	readonly board: Board;
};

export type Registry = {
	provide(plugin: string, name: string, fn: Provider): void;
	call(plugin: string, name: string, args: readonly unknown[]): unknown;
	collect(name: string, args: readonly unknown[]): unknown[];
};

type Call = (...args: readonly unknown[]) => unknown;

const PLUGIN_NAME = /^[a-z]+(-[a-z]+)*$/;

// One entry of the config's plugin list as a `Plugin`, else why it is not one.
export function asPlugin(entry: unknown): Plugin | string {
	if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return `expected a plugin such as youtrack({ ... }), got ${describe(entry)}`;
	const plugin = entry as Readonly<Record<string, unknown>>;
	const { name, options, requires } = plugin;
	if (typeof name !== "string" || !PLUGIN_NAME.test(name)) return `expected a plugin name of lowercase letters and dashes, got ${describe(name)}`;
	if (options !== undefined && (typeof options !== "object" || options === null || Array.isArray(options)))
		return `${name}: expected options as an object, got ${describe(options)}`;
	if (requires !== undefined && !(Array.isArray(requires) && requires.every((item) => typeof item === "string")))
		return `${name}: expected requires as a list of plugin names, got ${describe(requires)}`;
	if (typeof plugin.setup !== "function") return `${name}: expected a setup function, got ${describe(plugin.setup)}`;
	for (const key of ["check", "start", "stop"])
		if (plugin[key] !== undefined && typeof plugin[key] !== "function") return `${name}: expected ${key} as a function, got ${describe(plugin[key])}`;
	return entry as Plugin;
}

// A plugin's own step that throws (its `check`, `setup`, `beforeSpawn` or `prepare`), named by the plugin, the error as its cause.
export async function pluginStep<T>(plugin: string, step: string, run: () => T | Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		throw new Error(`plugin ${plugin}: ${step} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
	}
}

// The names provided by the plugins of one load; `plugin` is who provides or who calls, for the refusals.
export function registry(): Registry {
	const providers = new Map<string, { readonly plugin: string; readonly fn: Call }[]>();
	return {
		provide(plugin, name, fn) {
			providers.set(name, [...(providers.get(name) ?? []), { plugin, fn: fn as Call }]);
		},
		call(plugin, name, args) {
			const found = providers.get(name) ?? [];
			const [only] = found;
			if (only === undefined) throw new Error(`plugin ${plugin}: call("${name}"): no plugin provides it`);
			if (found.length > 1) {
				const by = found.map((entry) => entry.plugin).join(", ");
				throw new Error(`plugin ${plugin}: call("${name}"): provided by ${by}; call needs exactly one, collect reads them all`);
			}
			return only.fn(...args);
		},
		collect(name, args) {
			return (providers.get(name) ?? []).map((entry) => entry.fn(...args));
		},
	};
}

// `loading` holds until every plugin's `setup` has run and the core follows the jobs; a spawn then throws.
export function pluginHost(
	names: Registry,
	commands: CommandRegistry,
	bus: Bus,
	runner: JobRunner,
	own: Pick<Host, "name" | "options" | "env" | "folder" | "clock" | "agent">,
	loading: () => boolean,
): Host {
	return {
		...own,
		events: {
			on: (name, fn) => bus.on(own.name, name, fn),
			emit: (name, data) => bus.emit(own.name, name, data),
			read: (fromSeq) => bus.read(fromSeq),
		},
		provide: (name, fn) => names.provide(own.name, name, fn),
		call: <T>(name: string, ...args: readonly unknown[]) => names.call(own.name, name, args) as T,
		collect: <T>(name: string, ...args: readonly unknown[]) => names.collect(name, args) as T[],
		commands: { register: (command) => commands.register(own.name, command), route: commands.route, phone: commands.phone },
		jobs: {
			registerKind: (kind) => runner.registerKind(own.name, kind),
			registerRole: (role) => runner.registerRole(own.name, role),
			beforeSpawn: (check) => runner.beforeSpawn(own.name, check),
			prepare: (fn) => runner.prepare(own.name, fn),
			registerMachine: (machine) => runner.registerMachine(own.name, machine),
			run: (machine, argv) => runner.run(machine, argv),
			spawn: (request) => {
				if (loading()) throw new Error(`${own.name}: spawn during setup; start jobs from start() or later`);
				return runner.spawn(request);
			},
			block: (id, reason) => runner.block(id, reason),
			unblock: (id) => runner.unblock(id),
			running: () => runner.running(),
		},
		board: board(() => names.collect("projects", []), own.clock, (name, data) => bus.emit(own.name, name, data)),
	};
}

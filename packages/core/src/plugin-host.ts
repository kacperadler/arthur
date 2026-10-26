import { board } from "./board.ts";
import type { CommandRegistry } from "./commands.ts";
import { describe } from "./config.ts";
import type { Bus } from "./events.ts";
import type { JobRunner } from "./jobs.ts";
import type { Answer, Host, Plugin, Provider } from "./plugin.ts";

// The host's side of the plugin shape (plugin.ts): the config's entries read as plugins, the names they provide, and the host
// one plugin sees. The core's own; a plugin reaches none of it (docs/plugin-api.md).

export type Registry = {
	provide(plugin: string, name: string, fn: Provider): void;
	call(plugin: string, name: string, args: readonly unknown[]): unknown;
	collect(name: string, args: readonly unknown[]): unknown[];
	collectEach(name: string, args: readonly unknown[]): Answer<unknown>[];
};

type Call = (...args: readonly unknown[]) => unknown;

const PLUGIN_NAME = /^[a-z]+(-[a-z]+)*$/;

// One entry of the config's plugin list as a `Plugin`, else why it is not one.
export function asPlugin(entry: unknown): Plugin | string {
	if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return `expected a plugin such as youtrack({ ... }), got ${describe(entry)}`;
	const plugin = entry as Readonly<Record<string, unknown>>;
	const { name, options, requires, after, module } = plugin;
	if (typeof name !== "string" || !PLUGIN_NAME.test(name)) return `expected a plugin name of lowercase letters and dashes, got ${describe(name)}`;
	if (options !== undefined && (typeof options !== "object" || options === null || Array.isArray(options)))
		return `${name}: expected options as an object, got ${describe(options)}`;
	for (const [key, list] of [["requires", requires], ["after", after]] as const)
		if (list !== undefined && !(Array.isArray(list) && list.every((item) => typeof item === "string"))) return `${name}: expected ${key} as a list of plugin names, got ${describe(list)}`;
	if (module !== undefined && !(typeof module === "string" && module.startsWith("file:///"))) return `${name}: expected module as its own import.meta.url, a file: URL, got ${describe(module)}`;
	if (typeof plugin.setup !== "function") return `${name}: expected a setup function, got ${describe(plugin.setup)}`;
	for (const key of ["check", "doctor", "start", "stop"])
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
		collectEach(name, args) {
			return (providers.get(name) ?? []).map(({ plugin, fn }) => {
				try {
					return { plugin, value: fn(...args) };
				} catch (error) {
					return { plugin, error: error instanceof Error ? error : new Error(String(error)) };
				}
			});
		},
	};
}

// `loading` holds until every plugin's `setup` has run and the core follows the jobs; a spawn then throws.
export function pluginHost(
	names: Registry,
	commands: CommandRegistry,
	bus: Bus,
	runner: JobRunner,
	own: Pick<Host, "name" | "options" | "env" | "secrets" | "folder" | "clock" | "agent" | "code" | "package">,
	loading: () => boolean,
): Host {
	const tickets = board(() => names.collect("projects", []), own.clock, (name, data) => bus.emit(own.name, name, data));
	const { after: _, ...shown } = tickets;
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
		collectEach: <T>(name: string, ...args: readonly unknown[]) => names.collectEach(name, args) as Answer<T>[],
		commands: { register: (command) => commands.register(own.name, command), route: commands.route, phone: commands.phone, docs: commands.docs },
		jobs: {
			registerKind: (kind) => runner.registerKind(own.name, kind),
			registerRole: (role) => runner.registerRole(own.name, role),
			registerExtension: (url) => runner.registerExtension(url),
			beforeSpawn: (check) => runner.beforeSpawn(own.name, check),
			prepare: (fn) => runner.prepare(own.name, fn),
			registerMachine: (machine) => runner.registerMachine(own.name, machine),
			run: (machine, argv, limitSeconds, input) => runner.run(machine, argv, limitSeconds, input),
			machines: () => runner.machines(),
			home: (machine) => runner.home(machine),
			slice: runner.slice,
			spawn: (request) => {
				if (loading()) throw new Error(`${own.name}: spawn during setup; start jobs from start() or later`);
				return runner.spawn(request);
			},
			continue: (id, instruction, budgetUsd, decision) => runner.continue(id, instruction, budgetUsd, false, decision),
			block: (id, reason, stop) => runner.block(id, reason, stop),
			list: () => runner.records(),
			running: () => runner.running(),
			prune: (ids) => runner.prune(ids),
			result: (id) => runner.result(id),
			file: (id, job) => runner.file(tickets, id, job),
			prompt: (role, project) => runner.prompt(role, project),
			vision: (project, checkout) => runner.vision(project, checkout),
			criteria: () => runner.criteria(),
		},
		board: shown,
	};
}

import type { CommandRegistry, Commands } from "./commands.ts";
import type { Bus, Events } from "./events.ts";

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
	// Events go to every subscriber in this process and to the log `<home>/events.jsonl`, named by this plugin.
	readonly events: Events;
	// Several plugins may provide one name: `call` needs exactly one, `collect` reads them all, in setup order.
	provide(name: string, fn: Provider): void;
	call<T = unknown>(name: string, ...args: readonly unknown[]): T;
	collect<T = unknown>(name: string, ...args: readonly unknown[]): T[];
	// The command registry: `register` this plugin's commands; `route` and `phone` for a channel.
	readonly commands: Commands;
};

export type Registry = {
	provide(plugin: string, name: string, fn: Provider): void;
	call(plugin: string, name: string, args: readonly unknown[]): unknown;
	collect(name: string, args: readonly unknown[]): unknown[];
};

type Call = (...args: readonly unknown[]) => unknown;

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

export function pluginHost(names: Registry, commands: CommandRegistry, bus: Bus, own: Pick<Host, "name" | "options" | "env" | "folder">): Host {
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
	};
}

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Event, eventBus } from "./events.ts";
import { type Host, type Options, type Provider, pluginHost, registry } from "./plugin.ts";

// The test kit (spec/roadmap.md, entry 4), published as `@arthur/core/testing`. Loading it is the safety net, and `npm test`
// loads it into every test process (`--import`): every `ARTHUR_` variable and tmux's session variables are cleared and tmux's
// default socket moves into a temporary folder, so a test reaches no live bot, token or tmux server; every folder the kit
// makes is removed when the process exits, passed or failed.

for (const key of Object.keys(process.env)) if (key.startsWith("ARTHUR_") || key === "TMUX" || key === "TMUX_PANE") delete process.env[key];
const root = mkdtempSync(join(tmpdir(), "arthur-test-"));
process.env.TMUX_TMPDIR = root;
process.on("exit", () => rmSync(root, { recursive: true, force: true }));

// A new empty folder of the kit's, e.g. a test's home folder instead of a live `.arthur/`.
export function temporaryFolder(): string {
	return mkdtempSync(join(root, "folder-"));
}

// One `call` or `collect` the plugin made.
export type Use = { readonly kind: "call" | "collect"; readonly name: string; readonly args: readonly unknown[] };

export type FakeHost = {
	// Given to the plugin's `setup`.
	readonly host: Host;
	// What the plugin did through `host`, in order.
	readonly provided: readonly string[];
	readonly calls: readonly Use[];
	// The events the plugin emitted, as logged, in the order of their sequence numbers.
	readonly emitted: readonly Event[];
	// The test as another plugin: drives what the plugin provides, or provides what it calls.
	call<T = unknown>(name: string, ...args: readonly unknown[]): T;
	collect<T = unknown>(name: string, ...args: readonly unknown[]): T[];
	provide(name: string, fn: Provider): void;
	// An event from the plugin `test`, delivered to the plugin's subscribers and logged like any other.
	emit(name: string, data: unknown): Event;
};

// The host one plugin sees, alone: its options as given (`enabled` is the host's, left out), its env values, and its folder,
// `<temporary folder>/<name>/`, whose parent is the home folder holding the event log. A `call` refuses like the real
// host's, naming the plugin.
export function fakeHost(plugin: { readonly name: string; readonly options?: Options; readonly env?: Readonly<Record<string, string>> }): FakeHost {
	const names = registry();
	const home = temporaryFolder();
	const bus = eventBus(home);
	const folder = join(home, plugin.name);
	mkdirSync(folder);
	const real = pluginHost(names, bus, { name: plugin.name, options: plugin.options ?? {}, env: plugin.env ?? {}, folder });
	const provided: string[] = [];
	const calls: Use[] = [];
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
	};
	return {
		host,
		provided,
		calls,
		get emitted() {
			return bus.read(1).filter((event) => event.plugin === plugin.name);
		},
		call: <T>(name: string, ...args: readonly unknown[]) => names.call("test", name, args) as T,
		collect: <T>(name: string, ...args: readonly unknown[]) => names.collect(name, args) as T[],
		provide: (name, fn) => names.provide("test", name, fn),
		emit: (name, data) => bus.emit("test", name, data),
	};
}

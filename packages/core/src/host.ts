import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Board, board } from "./board.ts";
import { clock } from "./clock.ts";
import { type CommandRegistry, commandRegistry } from "./commands.ts";
import type { LoadedConfig } from "./config.ts";
import { resolveEnv, type Shell } from "./env.ts";
import { eventBus } from "./events.ts";
import { type JobRunner, jobRunner } from "./jobs.ts";
import { type Plugin, pluginHost, registry } from "./plugin.ts";

// The plugin host (spec/roadmap.md, entry 4): checks the config's plugin list, resolves the enabled plugins' env variables,
// gives each its folder and runs `setup` in dependency order. Every refusal names the plugins involved.

// The enabled plugins in setup order, which is the order `start` follows (and `stop` reverses); `warnings` come from the env file;
// `jobs` spawns with the kinds, checks and steps the plugins registered; `board` is the core's own, for `arthur ticket`: it
// reads the plugins' project list, names its events `core`, and follows the jobs: a worker's `job-started` moves each ticket its
// task names (`spec/features/<id>-<slug>/...`) to in-progress (spec/roadmap.md, entry 18); a move the board refuses is logged.
export type LoadedPlugins = { readonly plugins: readonly Plugin[]; readonly warnings: readonly string[]; readonly jobs: JobRunner; readonly board: Board };

const PLUGIN_NAME = /^[a-z]+(-[a-z]+)*$/;
const REQUIRED = "orchestration";
const FEATURE = /(?:^|\/)spec\/features\/([A-Z]+\d{4,})-[^/]*\//;

// `commands` holds what the core registered before; the plugins' commands join it, and a name registered twice refuses the load.
export async function loadPlugins(config: LoadedConfig, shell: Shell = process.env, commands: CommandRegistry = commandRegistry()): Promise<LoadedPlugins> {
	const sorted = await checkPlugins(config);
	const { values, warnings } = resolveEnv(config, shell);
	const names = registry();
	const time = clock(config.core.timeZone, config.core.quietHours);
	const bus = eventBus(config.core.home);
	const jobs = jobRunner(config.core.home, dirname(config.path), config.core.jobs, time, bus);
	for (const plugin of sorted) {
		const { enabled: _, ...options } = plugin.options ?? {};
		const folder = join(config.core.home, plugin.name);
		mkdirSync(folder, { recursive: true });
		const host = pluginHost(names, commands, bus, jobs, { name: plugin.name, options, env: values[plugin.name] ?? {}, folder, clock: time });
		await guard(plugin, "setup", () => plugin.setup(host));
	}
	const core = board(() => names.collect("projects", []), time, (name, data) => bus.emit("core", name, data));
	bus.on("core", "job-started", ({ data }) => {
		const { kind, tickets } = data as { readonly kind: string; readonly tickets: readonly string[] };
		if (kind !== "worker") return;
		const refused = tickets.flatMap((path) => {
			const id = FEATURE.exec(path)?.[1];
			try {
				if (id !== undefined) core.move(id, "in-progress");
				return [];
			} catch (error) {
				return [(error as Error).message];
			}
		});
		if (refused.length > 0) throw new Error(refused.join("; "));
	});
	return { plugins: sorted, warnings, jobs, board: core };
}

// The host's refusals before any `setup`, which `arthur config check` runs too: the plugin list, `orchestration`, `requires`,
// cycles and each enabled plugin's own `check`. Throws them, one line each; else returns the enabled plugins in setup order.
export async function checkPlugins(config: LoadedConfig): Promise<Plugin[]> {
	const at = (path: string) => `${config.path}: ${path}`;
	const problems: string[] = [];
	let unreadable = false;
	const plugins: Plugin[] = [];
	const first = new Map<string, number>();
	config.plugins.forEach((entry, index) => {
		const plugin = asPlugin(entry);
		if (typeof plugin === "string") {
			unreadable = true;
			return problems.push(at(`plugins[${index}]: ${plugin}`));
		}
		const before = first.get(plugin.name);
		if (before !== undefined) return problems.push(at(`plugins[${index}]: a second plugin named ${plugin.name}; the first is plugins[${before}]`));
		first.set(plugin.name, index);
		plugins.push(plugin);
	});
	const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));
	const enabled = plugins.filter((plugin) => plugin.options?.enabled !== false);
	if (!unreadable && !byName.has(REQUIRED)) problems.push(at(`plugins: ${REQUIRED} is required and missing; add ${REQUIRED}({ ... })`));
	if (byName.get(REQUIRED)?.options?.enabled === false) problems.push(at(`${REQUIRED}.enabled: ${REQUIRED} is required and cannot be disabled`));
	for (const plugin of enabled) {
		const { enabled: flag, ...options } = plugin.options ?? {};
		if (flag !== undefined && flag !== true) problems.push(at(`${plugin.name}.enabled: expected true or false, got ${describe(flag)}`));
		for (const { path, problem } of await guard(plugin, "check", () => plugin.check?.(options) ?? []))
			problems.push(at(`${plugin.name}.${path}: ${problem}`));
		for (const name of plugin.requires ?? []) {
			const required = byName.get(name);
			if (required === undefined) problems.push(at(`${plugin.name}.requires: ${plugin.name} requires ${name}, which is not in the plugin list`));
			else if (required.options?.enabled === false)
				problems.push(at(`${plugin.name}.requires: ${plugin.name} requires ${name}, which is disabled (enabled: false)`));
		}
	}
	if (problems.length > 0) throw new Error(problems.join("\n"));
	const sorted = setupOrder(enabled, byName);
	if (typeof sorted === "string") throw new Error(at(`plugins: a cycle in requires: ${sorted}`));
	return sorted;
}

// Required plugins first, otherwise the config's order; a cycle comes back as its path, e.g. `a -> b -> a`.
function setupOrder(plugins: readonly Plugin[], byName: ReadonlyMap<string, Plugin>): Plugin[] | string {
	const sorted: Plugin[] = [];
	const done = new Set<string>();
	const visit = (plugin: Plugin, path: readonly string[]): string | undefined => {
		if (done.has(plugin.name)) return undefined;
		const loop = path.indexOf(plugin.name);
		if (loop !== -1) return [...path.slice(loop), plugin.name].join(" -> ");
		for (const name of plugin.requires ?? []) {
			const required = byName.get(name);
			const cycle = required && visit(required, [...path, plugin.name]);
			if (cycle) return cycle;
		}
		done.add(plugin.name);
		sorted.push(plugin);
		return undefined;
	};
	for (const plugin of plugins) {
		const cycle = visit(plugin, []);
		if (cycle) return cycle;
	}
	return sorted;
}

function asPlugin(entry: unknown): Plugin | string {
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

// A plugin's own step that throws stops the load, named by the plugin.
async function guard<T>(plugin: Plugin, step: string, run: () => T | Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		throw new Error(`plugin ${plugin.name}: ${step} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
	}
}

function describe(value: unknown): string {
	if (value === undefined) return "nothing";
	if (value === null) return "null";
	if (Array.isArray(value)) return "a list";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "object") return "an object";
	return typeof value === "function" ? "a function" : String(value);
}

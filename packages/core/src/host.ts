import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LoadedConfig } from "./config.ts";
import { resolveEnv, type Shell } from "./env.ts";
import { eventBus } from "./events.ts";
import { type Plugin, pluginHost, registry } from "./plugin.ts";

// The plugin host (spec/roadmap.md, entry 4): checks the config's plugin list, resolves the enabled plugins' env variables,
// gives each its folder and runs `setup` in dependency order. Every refusal names the plugins involved.

// The enabled plugins in setup order, which is the order `start` follows (and `stop` reverses); `warnings` come from the env file.
export type LoadedPlugins = { readonly plugins: readonly Plugin[]; readonly warnings: readonly string[] };

const PLUGIN_NAME = /^[a-z]+(-[a-z]+)*$/;
const REQUIRED = "orchestration";

export async function loadPlugins(config: LoadedConfig, shell: Shell = process.env): Promise<LoadedPlugins> {
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
	const { values, warnings } = resolveEnv(config, shell);
	const names = registry();
	const bus = eventBus(config.core.home);
	for (const plugin of sorted) {
		const { enabled: _, ...options } = plugin.options ?? {};
		const folder = join(config.core.home, plugin.name);
		mkdirSync(folder, { recursive: true });
		const host = pluginHost(names, bus, { name: plugin.name, options, env: values[plugin.name] ?? {}, folder });
		await guard(plugin, "setup", () => plugin.setup(host));
	}
	return { plugins: sorted, warnings };
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

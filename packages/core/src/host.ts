import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Board, board } from "./board.ts";
import { moveStartedTickets, refuseUnstartableTickets } from "./board-jobs.ts";
import { clock } from "./clock.ts";
import { type CommandRegistry, commandRegistry } from "./commands.ts";
import { describe, type LoadedConfig } from "./config.ts";
import { resolveEnv, type Shell } from "./env.ts";
import { type Bus, eventBus } from "./events.ts";
import { type DoctorLine, doctor, ownAnswers } from "./doctor.ts";
import { knownProject } from "./job-checkout.ts";
import { SLICE } from "./job-scope.ts";
import { type JobRunner, jobRunner } from "./jobs.ts";
import { coreRequirements } from "./requirements.ts";
import { asPlugin, type Plugin, pluginHost, pluginStep, registry } from "./plugin.ts";

// The plugin host (spec/roadmap.md, entry 4): checks the config's plugin list, resolves the enabled plugins' env variables,
// gives each its folder and runs `setup` in dependency order. Every refusal names the plugins involved.

// The enabled plugins in setup order, which is the order `start` follows (and `stop` reverses); `warnings` come from the env file;
// `jobs` spawns with the kinds, checks and steps the plugins registered; `board` is the core's own, for `arthur ticket`: it
// reads the plugins' project list, names its events `core`, and follows the jobs: its `beforeSpawn` refuses a worker whose task
// names a ticket (`spec/features/<id>-<slug>/...`) that cannot move to in-progress, and a worker's `job-started` moves each such
// ticket to in-progress (spec/roadmap.md, entry 18); a move the board refuses then is logged.
// `follow` is what `arthur run` follows the event log with; `project` is the project a name names (job-checkout.ts), refusing
// one Arthur does not know; `autopilot` asks the plugin that provides `ticket.autopilot` to pre-approve a ticket (`arthur ticket`);
// `doctor` checks the core's requirements and each plugin's (`arthur doctor`); `emit` logs and delivers an event of the core's.
export type LoadedPlugins = { readonly plugins: readonly Plugin[]; readonly warnings: readonly string[]; readonly jobs: JobRunner; readonly board: Board; readonly follow: Bus["follow"]; readonly project: (name: string) => unknown; readonly autopilot: (request: AutopilotRequest) => unknown; readonly doctor: () => Promise<DoctorLine[]>; readonly emit: (name: string, data: unknown) => void };
export type AutopilotRequest = { readonly id: string; readonly budgetUsd?: number };

const REQUIRED = "orchestration";
const CORE = dirname(import.meta.dirname);

// `commands` holds what the core registered before; the plugins' commands join it, and a name registered twice refuses the load.
export async function loadPlugins(config: LoadedConfig, shell: Shell = process.env, commands: CommandRegistry = commandRegistry()): Promise<LoadedPlugins> {
	const sorted = await checkPlugins(config);
	const { values, warnings } = resolveEnv(config, shell);
	const names = registry();
	const time = clock(config.core.timeZone, config.core.quietHours);
	const bus = eventBus(config.core.home);
	const jobs = jobRunner(config.core.home, dirname(config.path), { ...config.core.jobs, slice: SLICE }, config.core.agent.command, time, bus, names.collect);
	let loading = true;
	// `Host.code`: the core's package folder, then the package folder of each plugin's own `module`, the nearest folder above it
	// with a package.json, once each; a plugin that names no module has none.
	const code = [...new Set([CORE, ...sorted.flatMap((plugin) => (plugin.module === undefined ? [] : (packageOf(fileURLToPath(plugin.module)) ?? [])))])];
	for (const plugin of sorted) {
		const { enabled: _, ...options } = plugin.options ?? {};
		const folder = join(config.core.home, plugin.name);
		mkdirSync(folder, { recursive: true });
		const host = pluginHost(names, commands, bus, jobs, { name: plugin.name, options, env: values[plugin.name] ?? {}, folder, clock: time, agent: config.core.agent.command, code }, () => loading);
		await pluginStep(plugin.name, "setup", () => plugin.setup(host));
	}
	const core = board(() => names.collect("projects", []), time, (name, data) => bus.emit("core", name, data));
	refuseUnstartableTickets(core, jobs);
	moveStartedTickets(core, bus);
	loading = false;
	const autopilot = (request: AutopilotRequest) => names.call("core", "ticket.autopilot", [request]);
	const project = (name: string) => knownProject(dirname(config.path), names.collect("projects", []), name);
	const checks = () => {
		const provided = names.collectEach("doctor", []);
		const answers = sorted.flatMap((plugin) => [...ownAnswers([plugin], config.core), ...provided.filter((answer) => answer.plugin === plugin.name)]);
		return doctor(coreRequirements(config.core.home, config.core.agent.command), answers);
	};
	return { plugins: sorted, warnings, jobs, board: core, follow: bus.follow, project, autopilot, doctor: checks, emit: (name, data) => void bus.emit("core", name, data) };
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
		for (const { path, problem } of await pluginStep(plugin.name, "check", () => plugin.check?.(options, config.core) ?? []))
			problems.push(at(`${plugin.name}.${path}: ${problem}`));
		for (const name of plugin.requires ?? []) {
			const required = byName.get(name);
			if (required === undefined) problems.push(at(`${plugin.name}.requires: ${plugin.name} requires ${name}, which is not in the plugin list`));
			else if (required.options?.enabled === false)
				problems.push(at(`${plugin.name}.requires: ${plugin.name} requires ${name}, which is disabled (enabled: false)`));
		}
	}
	if (problems.length > 0) throw new Error(problems.join("\n"));
	const sorted = setupOrder(enabled, new Map(enabled.map((plugin) => [plugin.name, plugin])));
	if (typeof sorted === "string") throw new Error(at(`plugins: a cycle in requires or after: ${sorted}`));
	return sorted;
}

// Required plugins and the enabled ones a plugin sets up after first, otherwise the config's order; a cycle comes back as its
// path, e.g. `a -> b -> a`.
function setupOrder(plugins: readonly Plugin[], byName: ReadonlyMap<string, Plugin>): Plugin[] | string {
	const sorted: Plugin[] = [];
	const done = new Set<string>();
	const visit = (plugin: Plugin, path: readonly string[]): string | undefined => {
		if (done.has(plugin.name)) return undefined;
		const loop = path.indexOf(plugin.name);
		if (loop !== -1) return [...path.slice(loop), plugin.name].join(" -> ");
		for (const name of [...(plugin.requires ?? []), ...(plugin.after ?? [])]) {
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

function packageOf(file: string): string | undefined {
	for (let folder = dirname(file); folder !== dirname(folder); folder = dirname(folder)) if (existsSync(join(folder, "package.json"))) return folder;
	return undefined;
}

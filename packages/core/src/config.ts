import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { table } from "./core-options.ts";
import type { OptionTable } from "./option-table.ts";

// The config file and the core's own options (spec/roadmap.md, entries 2 and 93; their table: core-options.ts).

export type QuietHours = { readonly from: string; readonly to: string };

export type CoreOptions = {
	readonly home?: string;
	readonly envFile?: string;
	readonly agent?: { readonly command?: string };
	readonly timeZone?: string;
	readonly quietHours?: QuietHours;
	readonly jobs?: {
		readonly timeoutMinutes?: number;
		readonly budgetUsd?: number;
		readonly idleMinutes?: number;
		readonly cpu?: number;
		readonly memory?: string;
		readonly offlineGraceMinutes?: number;
	};
};

export type ArthurConfig = { readonly core?: CoreOptions; readonly plugins?: readonly unknown[] };

// The config as loaded: every core option set, `home` and `envFile` absolute (relative ones are taken from the config's folder).
export type LoadedConfig = {
	readonly path: string;
	readonly core: {
		readonly home: string;
		readonly envFile: string;
		readonly agent: { readonly command: string };
		readonly timeZone: string;
		readonly quietHours: QuietHours | undefined;
		readonly jobs: { readonly timeoutMinutes: number; readonly budgetUsd: number; readonly idleMinutes: number; readonly cpu: number; readonly memory: string; readonly offlineGraceMinutes: number };
	};
	readonly plugins: readonly unknown[];
};

export function defineConfig(config: ArthurConfig): ArthurConfig {
	return config;
}

export async function loadConfig(path: string): Promise<LoadedConfig> {
	const file = resolve(path);
	if (!existsSync(file)) throw new Error(`config file not found: ${file}`);
	let module: { readonly default?: unknown };
	try {
		// The path is the caller's, known only at run time.
		module = await import(pathToFileURL(file).href);
	} catch (error) {
		throw new Error(`config file ${file} failed to load: ${error instanceof Error ? error.message : String(error)}`);
	}
	const problems: string[] = [];
	checkShape(module.default, FILE, "", problems);
	if (problems.length > 0) throw new Error(problems.map((problem) => `${file}: ${problem}`).join("\n"));
	return withDefaults(module.default as ArthurConfig, file);
}

// The config file: the core's options (core-options.ts), then the plugin list, which the host checks.
const FILE: OptionTable = {
	core: { about: "The core's own options", fields: table },
	plugins: { about: "The plugins, each called with its options", check: (value) => (value === undefined || Array.isArray(value) ? undefined : "a list") },
};

// Each entry's check gets its value, a left-out one included; a nested object left out is not walked.
function checkShape(value: unknown, shape: OptionTable, path: string, problems: string[]): void {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		problems.push(`${path || "default export"}: expected an object${path ? "" : " from defineConfig({ ... })"}, got ${describe(value)}`);
		return;
	}
	const record = value as Readonly<Record<string, unknown>>;
	const at = (key: string) => (path ? `${path}.${key}` : key);
	for (const key of Object.keys(record))
		if (!Object.hasOwn(shape, key)) problems.push(`${at(key)}: unknown option; expected one of ${Object.keys(shape).join(", ")}`);
	for (const [key, entry] of Object.entries(shape)) {
		const field = record[key];
		if ("fields" in entry) {
			if (field !== undefined) checkShape(field, entry.fields, at(key), problems);
			continue;
		}
		const expected = entry.check(field);
		if (expected) problems.push(`${at(key)}: expected ${expected}, got ${describe(field)}`);
	}
}

export function describe(value: unknown): string {
	if (value === undefined) return "nothing";
	if (value === null) return "null";
	if (Array.isArray(value)) return "a list";
	if (typeof value === "object") return "an object";
	if (typeof value === "function") return "a function";
	if (typeof value === "string") return JSON.stringify(value);
	return String(value);
}

function withDefaults(config: ArthurConfig, file: string): LoadedConfig {
	const core = config.core ?? {};
	const folder = dirname(file);
	return {
		path: file,
		core: {
			home: resolve(folder, core.home ?? ".arthur"),
			envFile: resolve(folder, core.envFile ?? ".env"),
			agent: { command: core.agent?.command ?? "omp" },
			timeZone: core.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
			quietHours: core.quietHours && { from: core.quietHours.from, to: core.quietHours.to },
			jobs: {
				timeoutMinutes: core.jobs?.timeoutMinutes ?? 120,
				budgetUsd: core.jobs?.budgetUsd ?? 2,
				idleMinutes: core.jobs?.idleMinutes ?? 10,
				cpu: core.jobs?.cpu ?? machineLimit().cpu,
				memory: core.jobs?.memory ?? machineLimit().memory,
				offlineGraceMinutes: core.jobs?.offlineGraceMinutes ?? 30,
			},
		},
		plugins: config.plugins ?? [],
	};
}

// The jobs' joint limit when the config sets none: here, and on another machine, where the config is not, from its own cores.
export const machineLimit = () => ({ cpu: Math.max(1, availableParallelism() - 1), memory: "70%" });

// What `arthur version` prints; a machine that runs jobs must print the same (job-machine.ts), which the machines plugin checks.
export { coreVersion } from "./job-machine.ts";

// systemd's MemoryMax in bytes (core-options.ts, the check of `jobs.memory`), for the plugins.
export { memoryBytes } from "./core-options.ts";

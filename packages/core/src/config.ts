import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The config file and the core's own options (spec/roadmap.md, entry 2). The plugin list is the host's to check.

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
		readonly cpu?: number;
		readonly memory?: string;
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
		readonly jobs: { readonly timeoutMinutes: number; readonly budgetUsd: number; readonly cpu: number; readonly memory: string };
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
	checkShape(module.default, SHAPE, "", problems);
	if (problems.length > 0) throw new Error(problems.map((problem) => `${file}: ${problem}`).join("\n"));
	return withDefaults(module.default as ArthurConfig, file);
}

// A check returns what was expected when the value is wrong. A nested shape is an optional section whose keys are checked in turn.
type Check = (value: unknown) => string | undefined;
type Shape = { readonly [key: string]: Check | Shape };

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const PERCENT = /^\d{1,3}(\.\d{1,2})?%$/;
const SIZE = /^(\d+)(?:\.(\d{1,2}))?([KMGT]?)$/;

const optional =
	(check: Check): Check =>
	(value) =>
		value === undefined ? undefined : check(value);
const text: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "a non-empty string");
const clock: Check = (value) => (typeof value === "string" && HH_MM.test(value) ? undefined : 'a time "HH:MM" from 00:00 to 23:59');
const atLeastZero: Check = (value) =>
	typeof value === "number" && Number.isFinite(value) && value >= 0 ? undefined : "a number of 0 or more";

const SHAPE: Shape = {
	core: {
		home: optional(text),
		envFile: optional(text),
		agent: { command: optional(text) },
		timeZone: optional((value) => (typeof value === "string" && knownZone(value) ? undefined : "a time zone such as Europe/Warsaw")),
		quietHours: { from: clock, to: clock },
		jobs: {
			timeoutMinutes: optional(atLeastZero),
			budgetUsd: optional(atLeastZero),
			cpu: optional((value) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? undefined : "a number above 0")),
			memory: optional((value) =>
				typeof value === "string" && memoryMax(value) ? undefined : 'systemd MemoryMax syntax such as "70%", "8G" or "infinity"',
			),
		},
	},
	plugins: optional((value) => (Array.isArray(value) ? undefined : "a list")),
};

function checkShape(value: unknown, shape: Shape, path: string, problems: string[]): void {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		problems.push(`${path || "default export"}: expected an object${path ? "" : " from defineConfig({ ... })"}, got ${describe(value)}`);
		return;
	}
	const record = value as Readonly<Record<string, unknown>>;
	const at = (key: string) => (path ? `${path}.${key}` : key);
	for (const key of Object.keys(record))
		if (!Object.hasOwn(shape, key)) problems.push(`${at(key)}: unknown option; expected one of ${Object.keys(shape).join(", ")}`);
	for (const [key, check] of Object.entries(shape)) {
		const field = record[key];
		if (typeof check !== "function") {
			if (field !== undefined) checkShape(field, check, at(key), problems);
			continue;
		}
		const expected = check(field);
		if (expected) problems.push(`${at(key)}: expected ${expected}, got ${describe(field)}`);
	}
}

function knownZone(name: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: name });
		return true;
	} catch {
		return false;
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
				cpu: core.jobs?.cpu ?? Math.max(1, availableParallelism() - 1),
				memory: core.jobs?.memory ?? "70%",
			},
		},
		plugins: config.plugins ?? [],
	};
}

// systemd's MemoryMax, as far as systemd takes it: `infinity`; a percentage above 0 and up to 100 with at most 2 decimals;
// or bytes with at most 2 decimals and an optional K, M, G or T (powers of 1024), at least 1 byte once the fraction is cut
// and below 2^63 (systemd refuses some values below 2^64). The rest is refused, a few values systemd takes (P, E, more
// decimals) included.
function memoryMax(text: string): boolean {
	if (text === "infinity") return true;
	if (PERCENT.test(text)) return Number(text.slice(0, -1)) > 0 && Number(text.slice(0, -1)) <= 100;
	const [, whole, fraction = "", unit = ""] = SIZE.exec(text) ?? [];
	if (whole === undefined) return false;
	const bytes = (BigInt(whole + fraction) * 1024n ** BigInt(["", "K", "M", "G", "T"].indexOf(unit))) / 10n ** BigInt(fraction.length);
	return bytes >= 1n && bytes < 2n ** 63n;
}

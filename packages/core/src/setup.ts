import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { envLine, readConfig } from "./config-check.ts";
import * as core from "./core-options.ts";
import { type DoctorLine, doctor, ownAnswers } from "./doctor.ts";
import type { Shell } from "./env.ts";
import { installedPlugins, type OptionsFile, toolVersion } from "./installed.ts";
import { everyOption, type OptionTable, type Tool } from "./option-table.ts";
import type { Options } from "./plugin.ts";
import { asPlugin } from "./plugin-host.ts";
import { coreRequirements } from "./requirements.ts";

// `arthur setup` (spec/roadmap.md, entry 94): what is installed, what the config sets, what `arthur doctor` finds missing,
// what could still go in the config, and the next steps: docs/commands/setup.md. It writes no file, installs nothing, runs no
// model and prints no variable's value.

const CONFIG = "arthur.config.ts";

// `problem`: what the binary's own load refused; `checks`: `arthur doctor` over the loaded plugins, when they loaded, else the
// core's requirements and each plugin's own `doctor` are checked. Prints the report; returns 1 when a step in Next would refuse
// `arthur run`, else 0.
export async function setup(shell: Shell, problem: string | undefined, checks: (() => Promise<DoctorLine[]>) | undefined): Promise<number> {
	const path = resolve(CONFIG);
	const found = existsSync(path);
	const read = found ? await readConfig(path, shell, problem) : undefined;
	const config = read?.config;
	const env = read?.env;
	const installed = await installedPlugins(dirname(path));
	// The plugins the config lists, each once, and whether it is on; none without a config, unknown when it does not load.
	const listed = (config?.plugins ?? []).map(asPlugin).filter((plugin) => typeof plugin !== "string").filter((plugin, index, all) => all.findIndex((other) => other.name === plugin.name) === index);
	const on = new Map(listed.map((plugin) => [plugin.name, plugin.options?.enabled !== false]));
	const known = !found || config !== undefined;
	const mark = (name: string) => (!known || on.get(name) === true ? "" : on.has(name) ? " (off)" : " (not in the config)");
	const order = [...listed.map((plugin) => plugin.name).filter((name) => installed.has(name)), ...[...installed.keys()].filter((name) => !on.has(name))];

	const out = ["Tools", ...(await tools([["core", core.tools], ...order.map((name) => [name + mark(name), installed.get(name)?.tools ?? []] as const)])), ""];

	out.push(`Config: ${found ? CONFIG : `no ${CONFIG}`}`);
	const refusals = [...(read?.refused ?? []), ...(env?.problems ?? [])];
	if (config !== undefined && env !== undefined) {
		// loadConfig checked its shape; this is its module again, from the cache: the core's options as written, not defaulted.
		const module: { readonly default: { readonly core?: Options } } = await import(pathToFileURL(path).href);
		const written = module.default.core ?? {};
		const width = Math.max(4, ...listed.map((plugin) => plugin.name.length)) + 2;
		out.push(`  ${"core".padEnd(width)}${options(written, core.table)}`);
		for (const plugin of listed) {
			if (on.get(plugin.name) !== true) {
				out.push(`  ${plugin.name.padEnd(width)}off (enabled: false)`);
				continue;
			}
			const { enabled: _, ...given } = plugin.options ?? {};
			const file = installed.get(plugin.name);
			out.push(`  ${plugin.name.padEnd(width)}on   ${options(given, file !== undefined && "table" in file ? file.table : undefined)}`);
			for (const variable of env.variables) if (variable.plugin === plugin.name) out.push(`  ${" ".repeat(width)}env ${envLine(variable)}`);
		}
		out.push(...env.warnings.map((warning) => `  ${warning}`));
	}
	out.push(...refusals.flatMap((refusal) => refusal.split("\n")).map((line) => `  refused: ${line}`), "");

	out.push("Requirements (arthur doctor)");
	const lines = config === undefined ? [] : await (checks?.() ?? doctor(coreRequirements(config.core.home, config.core.agent.command), ownAnswers(config.plugins, config.core)));
	if (config === undefined) out.push(`  skipped: ${found ? `${CONFIG} does not load` : `no ${CONFIG}`}`);
	out.push(...lines.map((line) => `  ${line.text}`));
	if (config !== undefined && checks === undefined) out.push(`  the requirements a plugin checks in its setup are not checked until what Config refuses is fixed`);
	out.push("", `Can still go in ${CONFIG}`);
	const later = known ? order.filter((name) => on.get(name) !== true) : [];
	if (!known) out.push(`  skipped: ${CONFIG} does not load`);
	else if (later.length === 0) out.push("  nothing");
	for (const name of later) out.push(...canGo(name + mark(name), installed.get(name) ?? { problem: "no options table", tools: [] }));

	const steps: { readonly text: string; readonly refuses: boolean }[] = [];
	if (!found) steps.push({ text: `Write ${CONFIG} (docs/setup.md, step 5), then arthur config check`, refuses: true });
	if (refusals.length > 0) steps.push({ text: "Fix what Config refuses above, then arthur config check", refuses: true });
	for (const variable of env?.variables ?? [])
		if (!variable.set && config !== undefined) steps.push({ text: `Set ${variable.name} in ${relative(dirname(path), config.core.envFile)} (${variable.option}), then arthur config check`, refuses: true });
	const missing = lines.filter((line) => line.missing);
	for (const line of [...missing.filter((each) => each.critical), ...missing.filter((each) => !each.critical)]) steps.push({ text: line.fix ?? line.text, refuses: line.critical });
	const next = steps.filter((step, index) => steps.findIndex((other) => other.text === step.text) === index);
	out.push("", "Next");
	if (next.length === 0) out.push("  nothing");
	else out.push(...next.map((step, index) => `  ${index + 1}. ${step.text}${step.refuses ? ". Refuses the start." : ""}`), "Run arthur setup again after each step.");
	console.log(out.join("\n"));
	return next.some((step) => step.refuses) ? 1 : 0;
}

// One row per tool, the first package to name it giving its version command: its name, version, and who uses it.
async function tools(packages: readonly (readonly [string, readonly Tool[]])[]): Promise<string[]> {
	const users = new Map<string, { readonly tool: Tool; readonly by: string[] }>();
	for (const [name, list] of packages)
		for (const tool of list) {
			const entry = users.get(tool.name) ?? { tool, by: [] };
			users.set(tool.name, entry);
			entry.by.push(name);
		}
	return columns(await Promise.all([...users.values()].map(async ({ tool, by }) => [tool.name, await toolVersion(tool), by.join(", ")])), "  ");
}

// `set: <paths>; not set: <paths>` of `table` in `value`, a set object's fields walked, a list with its length; without a table,
// the keys as written.
function options(value: Options, table: OptionTable | undefined): string {
	const set: string[] = [];
	const unset: string[] = [];
	const walk = (record: Options, inner: OptionTable, at: string): void => {
		for (const [key, entry] of Object.entries(inner)) {
			const field = record[key];
			if (field === undefined) unset.push(at + key);
			else if ("fields" in entry && typeof field === "object" && field !== null) walk(field as Options, entry.fields, `${at}${key}.`);
			else set.push(Array.isArray(field) ? `${at}${key} (${field.length})` : at + key);
		}
	};
	if (table === undefined) set.push(...Object.keys(value));
	else walk(value, table, "");
	const parts = [set.length > 0 ? `set: ${set.join(", ")}` : "", unset.length > 0 ? `not set: ${unset.join(", ")}` : "", table === undefined ? "no options table" : ""];
	return parts.filter((part) => part !== "").join("; ") || "no options";
}

// A plugin that is off or not in the config: what it is, and each option's meaning and default.
function canGo(name: string, file: OptionsFile): string[] {
	if ("problem" in file) return [`  ${name}: ${file.problem}`];
	const rows = everyOption(file.table).map(({ path, entry }) => [path, entry.default === undefined ? entry.about : `${entry.about}; default ${entry.default}`]);
	return [`  ${name}: ${file.summary}`, ...columns(rows, "    ")];
}

// Each row's cells aligned: every column but the last padded to its longest cell and two spaces.
function columns(rows: readonly (readonly string[])[], indent: string): string[] {
	const widths: number[] = [];
	for (const row of rows) row.forEach((cell, index) => (widths[index] = Math.max(widths[index] ?? 0, cell.length)));
	return rows.map((row) => indent + row.map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd((widths[index] ?? 0) + 2))).join(""));
}

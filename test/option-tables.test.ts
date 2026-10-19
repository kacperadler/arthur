import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfig } from "@arthur/core";
import { everyOption, type OptionEntry, type OptionTable, type Tool } from "@arthur/core/option-table";
import * as core from "@arthur/core/options";
import type { Plugin } from "@arthur/core/plugin";
import { temporaryFolder } from "@arthur/core/testing";
import { machines } from "@arthur/machines";
import * as machinesFile from "@arthur/machines/options";
import { orchestration } from "@arthur/orchestration";
import * as orchestrationFile from "@arthur/orchestration/options";
import { projects } from "@arthur/projects";
import * as projectsFile from "@arthur/projects/options";
import { resources } from "@arthur/resources";
import * as resourcesFile from "@arthur/resources/options";
import { schedule } from "@arthur/schedule";
import * as scheduleFile from "@arthur/schedule/options";
import { session } from "@arthur/session";
import * as sessionFile from "@arthur/session/options";

// Roadmap entry 93 over every package's options file: what `arthur setup` (94) reads. A plugin's own tests never load another
// plugin; this one, outside every package, loads them all.

type OptionsFile = { readonly table: OptionTable; readonly summary: string; readonly tools: readonly Tool[] };

const PLUGINS: Readonly<Record<string, readonly [OptionsFile, Plugin]>> = {
	orchestration: [orchestrationFile, orchestration()],
	projects: [projectsFile, projects({ list: [] })],
	machines: [machinesFile, machines()],
	resources: [resourcesFile, resources({})],
	session: [sessionFile, session()],
	schedule: [scheduleFile, schedule()],
};

// What is wrong with `file`: an option, at any depth, whose meaning or default is not one line; a summary that is not one
// line; a tool without the command that prints its version.
function problems(name: string, file: OptionsFile): string[] {
	const line = (text: unknown) => typeof text === "string" && text.trim() !== "" && !/[\r\n]/.test(text);
	const options = everyOption(file.table).flatMap(({ path, entry }) => [
		...(line(entry.about) ? [] : [`${name} ${path}: about is not one line`]),
		...(entry.default === undefined || line(entry.default) ? [] : [`${name} ${path}: default is not one line`]),
	]);
	const tools = file.tools.flatMap((tool) =>
		Array.isArray(tool.version) && tool.version.length > 0 && tool.version.every((word) => typeof word === "string" && word !== "") ? [] : [`${name} ${tool.name}: no version command`],
	);
	return [...(line(file.summary) ? [] : [`${name}: summary is not one line`]), ...options, ...tools];
}

test("every option of the core and of each plugin has its meaning in one line, each summary is one line, each tool its version command", () => {
	for (const [name, file] of [["core", core] as const, ...Object.entries(PLUGINS).map(([plugin, [options]]) => [plugin, options] as const)]) {
		assert.deepEqual(problems(name, file), [], name);
		assert.ok(everyOption(file.table).length > 0, `${name} has options`);
	}
	assert.deepEqual(
		core.tools.map((tool) => tool.name),
		["git", "node", "omp", "ssh", "systemd-run", "tailscale"],
	);
	assert.deepEqual(
		Object.values(PLUGINS).flatMap(([file]) => file.tools.map((tool) => tool.name)),
		["tmux"],
	);
});

test("refused: an option without about, with an empty one or a line break, at any depth; a summary empty or of two lines; a tool without a version", () => {
	const check = () => undefined;
	const table = {
		bare: { check } as unknown as OptionEntry,
		empty: { about: " ", check },
		deep: { about: "A section", fields: { inner: { about: "Inner", fields: { leaf: { about: "one\ntwo", check } } } } },
		list: { about: "A list", check, each: { item: { about: "", check } } },
		fine: { about: "Fine", default: "two\nlines", check },
	};
	const tools = [{ name: "tmux" } as unknown as Tool, { name: "git", version: [] }, { name: "omp", version: ["omp", ""] }, { name: "node", version: ["node", "--version"] }];
	assert.deepEqual(problems("x", { summary: "", tools, table }), [
		"x: summary is not one line",
		"x bare: about is not one line",
		"x empty: about is not one line",
		"x deep.inner.leaf: about is not one line",
		"x list.*.item: about is not one line",
		"x fine: default is not one line",
		"x tmux: no version command",
		"x git: no version command",
		"x omp: no version command",
	]);
	assert.deepEqual(problems("x", { summary: "one\ntwo", tools: [], table: {} }), ["x: summary is not one line"]);
});

test("an option two levels deep has its meaning like a top-level one, after its parent; a list's or record's items under *", () => {
	const paths = (table: OptionTable) => everyOption(table).map(({ path }) => path);
	const about = (table: OptionTable, path: string) => everyOption(table).find((each) => each.path === path)?.entry.about;
	const coordinator = paths(orchestrationFile.table);
	assert.deepEqual(coordinator.slice(0, 7), ["maxAgents", "coordinator", "coordinator.model", "coordinator.thinking", "coordinator.tmux", "coordinator.tmux.session", "coordinator.tmux.socket"]);
	assert.equal(about(orchestrationFile.table, "coordinator.tmux.session"), "The tmux session's name");
	assert.ok(coordinator.includes("roles.*.model"), "a role's model");
	assert.ok(paths(projectsFile.table).includes("list.*.prefix"), "a project's prefix");
	assert.ok(paths(machinesFile.table).includes("list.*.labels.os"), "a machine's os, three levels down");
	assert.ok(paths(core.table).includes("jobs.memory"), "the core's jobs.memory");
});

test("each package's check refuses an unknown option, naming its path and exactly the options of its table", async () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), "export default { core: { jobs: { nope: 1 } } };\n");
	await assert.rejects(loadConfig(join(folder, "arthur.config.ts")), (error: Error) => {
		const fields = core.table.jobs !== undefined && "fields" in core.table.jobs ? core.table.jobs.fields : {};
		assert.ok(error.message.endsWith(`core.jobs.nope: unknown option; expected one of ${Object.keys(fields).join(", ")}`), error.message);
		return true;
	});
	writeFileSync(join(folder, "empty.config.ts"), "export default {};\n");
	const loaded = (await loadConfig(join(folder, "empty.config.ts"))).core;
	for (const [name, [file, plugin]] of Object.entries(PLUGINS)) {
		const refused = plugin.check?.({ nope: 1 }, loaded).find((each) => each.path === "nope");
		assert.ok(refused?.problem.endsWith(`: ${Object.keys(file.table).join(", ")}`), `${name}: ${refused?.problem}`);
	}
});

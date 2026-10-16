import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { LoadedConfig } from "../src/config.ts";
import type { Shell } from "../src/env.ts";
import { loadPlugins } from "../src/host.ts";
import type { Host, Plugin } from "../src/plugin.ts";
import { temporaryFolder } from "../src/testing.ts";

// A loaded config with its own home folder and no env file.
function config(plugins: readonly unknown[]): LoadedConfig {
	const folder = temporaryFolder();
	const jobs = { timeoutMinutes: 120, budgetUsd: 2, cpu: 1, memory: "70%" };
	const core = { home: join(folder, ".arthur"), envFile: join(folder, "env"), agent: { command: "omp" }, timeZone: "UTC", quietHours: undefined, jobs };
	return { path: join(folder, "arthur.config.ts"), core, plugins };
}

// A fake plugin that notes its setup in `ran`, then does `setup`.
function fake(ran: string[], name: string, more: Partial<Plugin> = {}): Plugin {
	return { name, ...more, setup: async (host) => {
		ran.push(name);
		await more.setup?.(host);
	} };
}

async function refusal(loaded: LoadedConfig, shell: Shell = {}): Promise<string> {
	try {
		await loadPlugins(loaded, shell);
	} catch (error) {
		return (error as Error).message;
	}
	assert.fail("loadPlugins passed, expected a refusal");
}

test("setup runs in dependency order, then in the config's order; each plugin gets its options, env and folder", async () => {
	const ran: string[] = [];
	const hosts: Host[] = [];
	const keep = (host: Host) => void hosts.push(host);
	const loaded = config([
		fake(ran, "session", { requires: ["orchestration", "schedule"], setup: keep }),
		fake(ran, "orchestration", { options: { enabled: true, maxAgents: 3 }, setup: keep }),
		fake(ran, "schedule", { options: { tokenEnv: "ARTHUR_SCHEDULE_TOKEN" }, setup: keep }),
		fake(ran, "telegram"),
	]);
	const { plugins } = await loadPlugins(loaded, { ARTHUR_SCHEDULE_TOKEN: "secret" });
	assert.deepEqual(ran, ["orchestration", "schedule", "session", "telegram"]);
	assert.deepEqual(plugins.map((plugin) => plugin.name), ran);
	const [orchestration, schedule] = hosts;
	assert.deepEqual(orchestration?.options, { maxAgents: 3 });
	assert.deepEqual(schedule?.env, { ARTHUR_SCHEDULE_TOKEN: "secret" });
	assert.deepEqual(orchestration?.env, {});
	for (const host of hosts) {
		assert.equal(host.folder, join(loaded.core.home, host.name));
		assert.ok(existsSync(host.folder), host.folder);
	}
});

test("provide, call and collect between plugins; collect with no provider returns empty", async () => {
	const seen: unknown[] = [];
	const ran: string[] = [];
	await loadPlugins(
		config([
			fake(ran, "orchestration", { setup: (host) => host.provide("prompt", (role: string) => `orchestration for ${role}`) }),
			fake(ran, "machines", {
				setup: (host) => {
					host.provide("jobs.place", (job: string) => `local for ${job}`);
					host.provide("prompt", () => "machines");
				},
			}),
			fake(ran, "projects", {
				requires: ["machines"],
				setup: (host) => {
					seen.push(host.call("jobs.place", "AR1"), host.collect("prompt", "worker"), host.collect("health"));
				},
			}),
		]),
	);
	assert.deepEqual(seen, ["local for AR1", ["orchestration for worker", "machines"], []]);
});

test("every plugin gets one clock, in the config's time zone with its quiet hours", async () => {
	const hosts: Host[] = [];
	const keep = (host: Host) => void hosts.push(host);
	const loaded = config([fake([], "orchestration", { setup: keep }), fake([], "telegram", { setup: keep })]);
	const core = { ...loaded.core, timeZone: "Europe/Warsaw", quietHours: { from: "22:00", to: "07:30" } };
	await loadPlugins({ ...loaded, core });
	const [orchestration, telegram] = hosts;
	assert.equal(orchestration?.clock, telegram?.clock);
	assert.equal(telegram?.clock.timeZone, "Europe/Warsaw");
	assert.equal(telegram?.clock.isQuiet(new Date("2026-07-01T21:30:00Z")), true, "23:30 in Warsaw");
	assert.equal(telegram?.clock.isQuiet(new Date("2026-07-01T05:30:00Z")), false, "07:30 in Warsaw");
	assert.ok(Math.abs((telegram?.clock.now().getTime() ?? 0) - Date.now()) < 60_000, "the real clock tells the time");
});

test("a call to a name nobody provides, or that two plugins provide, is refused naming the plugins", async () => {
	const call = (name: string) => fake([], "projects", { setup: (host) => void host.call(name) });
	const one = await refusal(config([fake([], "orchestration"), call("jobs.place")]));
	assert.match(one, /^plugin projects: setup failed: plugin projects: call\("jobs\.place"\): no plugin provides it$/);
	const provider = (name: string) => fake([], name, { setup: (host) => host.provide("channel.send", () => undefined) });
	const two = await refusal(config([provider("orchestration"), provider("telegram"), call("channel.send")]));
	assert.match(two, /call\("channel\.send"\): provided by orchestration, telegram; call needs exactly one/);
});

test("orchestration is required: missing, or enabled: false on it, is refused", async () => {
	const missing = config([fake([], "telegram")]);
	assert.equal(await refusal(missing), `${missing.path}: plugins: orchestration is required and missing; add orchestration({ ... })`);
	const off = config([fake([], "orchestration", { options: { enabled: false } })]);
	assert.equal(await refusal(off), `${off.path}: orchestration.enabled: orchestration is required and cannot be disabled`);
});

test("a missing required plugin is refused, and a disabled one like a missing one, naming both plugins", async () => {
	const ran: string[] = [];
	const missing = config([fake(ran, "orchestration"), fake(ran, "session", { requires: ["schedule"] })]);
	assert.equal(await refusal(missing), `${missing.path}: session.requires: session requires schedule, which is not in the plugin list`);
	const off = config([fake(ran, "orchestration"), fake(ran, "session", { requires: ["schedule"] }), fake(ran, "schedule", { options: { enabled: false } })]);
	assert.equal(await refusal(off), `${off.path}: session.requires: session requires schedule, which is disabled (enabled: false)`);
	assert.deepEqual(ran, []);
});

test("a cycle in requires is refused, naming its plugins in order; a plugin requiring itself too", async () => {
	const cycle = config([
		fake([], "orchestration"),
		fake([], "a", { requires: ["b"] }),
		fake([], "b", { requires: ["c"] }),
		fake([], "c", { requires: ["a"] }),
	]);
	assert.equal(await refusal(cycle), `${cycle.path}: plugins: a cycle in requires: a -> b -> c -> a`);
	const self = config([fake([], "orchestration", { requires: ["orchestration"] })]);
	assert.equal(await refusal(self), `${self.path}: plugins: a cycle in requires: orchestration -> orchestration`);
});

test("two plugins with one name are refused, naming the plugin and both places, even when one is disabled", async () => {
	const twice = config([fake([], "orchestration"), fake([], "telegram"), fake([], "telegram", { options: { enabled: false } })]);
	assert.equal(await refusal(twice), `${twice.path}: plugins[2]: a second plugin named telegram; the first is plugins[1]`);
});

test("each plugin checks its own options, without enabled; its problems refuse the start, naming plugin and option path", async () => {
	const given: unknown[] = [];
	const loaded = config([
		fake([], "orchestration", {
			options: { enabled: true, maxAgents: -1 },
			check: (options) => {
				given.push(options);
				return [{ path: "maxAgents", problem: "expected a number of 1 or more, got -1" }];
			},
		}),
		fake([], "youtrack", { check: () => [{ path: "instances[1].name", problem: "expected a non-empty string, got nothing" }] }),
	]);
	assert.equal(
		await refusal(loaded),
		[
			`${loaded.path}: orchestration.maxAgents: expected a number of 1 or more, got -1`,
			`${loaded.path}: youtrack.instances[1].name: expected a non-empty string, got nothing`,
		].join("\n"),
	);
	assert.deepEqual(given, [{ maxAgents: -1 }]);
});

test("a disabled plugin is not loaded: not checked, no setup, no folder, its env variables not read", async () => {
	const ran: string[] = [];
	const loaded = config([
		fake(ran, "orchestration"),
		fake(ran, "signal", { options: { enabled: false, accountEnv: "ARTHUR_SIGNAL_ACCOUNT" }, check: () => assert.fail("checked") }),
	]);
	const { plugins } = await loadPlugins(loaded, {});
	assert.deepEqual(ran, ["orchestration"]);
	assert.deepEqual(plugins.map((plugin) => plugin.name), ["orchestration"]);
	assert.equal(existsSync(join(loaded.core.home, "signal")), false);
});

test("a missing env variable of an enabled plugin refuses the start before any setup", async () => {
	const ran: string[] = [];
	const loaded = config([fake(ran, "orchestration"), fake(ran, "telegram", { options: { botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN" } })]);
	assert.match(await refusal(loaded), /telegram\.botTokenEnv: ARTHUR_TELEGRAM_BOT_TOKEN is missing/);
	assert.deepEqual(ran, []);
});

test("a setup or a check that throws stops the load and names the plugin", async () => {
	const ran: string[] = [];
	const broken = fake(ran, "schedule", { setup: () => Promise.reject(new Error("no file")) });
	const setup = config([fake(ran, "orchestration"), broken, fake(ran, "telegram")]);
	assert.equal(await refusal(setup), "plugin schedule: setup failed: no file");
	assert.deepEqual(ran, ["orchestration", "schedule"]);
	const check = config([fake([], "orchestration"), fake([], "youtrack", { check: () => { throw new Error("bad"); } })]);
	assert.equal(await refusal(check), "plugin youtrack: check failed: bad");
});

test("an entry that is no plugin, or a plugin with a wrong field, is refused by its place", async () => {
	const loaded = config([
		"orchestration",
		{ name: "Telegram", setup() {} },
		{ name: "telegram" },
		{ name: "schedule", setup() {}, requires: "orchestration" },
		{ name: "session", setup() {}, options: [] },
		{ name: "youtrack", setup() {}, stop: true },
		fake([], "github", { options: { enabled: "no" } }),
	]);
	assert.equal(
		await refusal(loaded),
		[
			'plugins[0]: expected a plugin such as youtrack({ ... }), got "orchestration"',
			'plugins[1]: expected a plugin name of lowercase letters and dashes, got "Telegram"',
			"plugins[2]: telegram: expected a setup function, got nothing",
			"plugins[3]: schedule: expected requires as a list of plugin names, got \"orchestration\"",
			"plugins[4]: session: expected options as an object, got a list",
			"plugins[5]: youtrack: expected stop as a function, got true",
			'github.enabled: expected true or false, got "no"',
		]
			.map((line) => `${loaded.path}: ${line}`)
			.join("\n"),
	);
});

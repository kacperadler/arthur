import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stamper } from "../src/actor.ts";
import type { LoadedConfig } from "../src/config.ts";
import { readEvents } from "../src/event-log.ts";
import { loadPlugins } from "../src/host.ts";
import { takeLock } from "../src/lock.ts";
import type { Host } from "../src/plugin.ts";
import { temporaryFolder } from "../src/testing.ts";

const JOB = "2026-11-06-worker-0a1b2c3d";

test("the stamp names who acted, in order: a job, the owner on a channel, a plugin's actor, arthur run, the terminal's user", (t) => {
	const home = temporaryFolder();
	let answers: unknown[] = [];
	const stamp = stamper(home, undefined, () => answers, "owner");
	const terminal = { actor: "user:terminal:owner" };
	assert.deepEqual([stamp("core", "ticket-moved", {}), stamp("schedule", "notice", null), stamp("core", "doctor", "text")], [terminal, terminal, terminal]);
	// Data that answers messages is on them; a list of anything but event numbers is not.
	assert.deepEqual(stamp("orchestration", "coordinator-replied", { answers: [3, 5] }), { ...terminal, on: [3, 5] });
	for (const wrong of [["3"], [1.5], "3", {}]) assert.deepEqual(stamp("orchestration", "coordinator-replied", { answers: wrong }), terminal, JSON.stringify(wrong));
	// The owner on a channel: by the channel and its instance; without a channel, the event is the process's like any other.
	assert.deepEqual(stamp("telegram", "message-received", { channel: "telegram", parts: [] }), { actor: "user:telegram" });
	assert.deepEqual(stamp("telegram", "message-received", { channel: "telegram", instance: "work", parts: [] }), { actor: "user:telegram/work" });
	assert.deepEqual(stamp("discord", "phone-command", { channel: "discord", text: "/stopall" }), { actor: "user:discord" });
	assert.deepEqual(stamp("telegram", "message-received", { parts: [] }), terminal);
	assert.deepEqual(stamp("telegram", "notice", { channel: "telegram", text: "x" }), terminal, "only the owner's own events name him");
	// A plugin's answer: the first that names an actor, with its own `on`, else the data's.
	answers = [undefined, "coordinator", { actor: "" }, { actor: "agent:shop" }, { actor: "coordinator" }];
	assert.deepEqual(stamp("core", "job-started", { id: JOB }), { actor: "agent:shop" });
	answers = [{ actor: "coordinator", on: [4, 6] }];
	assert.deepEqual([stamp("core", "job-started", {}), stamp("orchestration", "coordinator-replied", { answers: [1] })], [{ actor: "coordinator", on: [4, 6] }, { actor: "coordinator", on: [4, 6] }]);
	answers = [{ actor: "coordinator", on: ["4"] }];
	assert.deepEqual([stamp("core", "job-started", {}), stamp("orchestration", "coordinator-replied", { answers: [1] })], [{ actor: "coordinator" }, { actor: "coordinator", on: [1] }]);
	assert.deepEqual(stamp("telegram", "message-received", { channel: "telegram" }), { actor: "user:telegram" }, "the owner's message stays his");
	// The process that holds run.pid: the core as arthur, a plugin by its name; a plugin's answer still comes first.
	const lock = takeLock(join(home, "run.pid"));
	assert.ok("release" in lock);
	t.after(lock.release);
	assert.deepEqual(stamp("core", "job-started", {}), { actor: "coordinator" });
	answers = [];
	assert.deepEqual([stamp("core", "job-started", {}), stamp("schedule", "schedule-fired", {}), stamp("orchestration", "coordinator-replied", { answers: [2] })], [{ actor: "arthur" }, { actor: "plugin:schedule" }, { actor: "plugin:orchestration", on: [2] }]);
	lock.release();
	assert.deepEqual(stamp("core", "job-started", {}), terminal, "once released, no longer arthur run");
	// A run.pid of another live process, this one's parent, is not this process's.
	writeFileSync(join(home, "run.pid"), `${process.ppid}\n`);
	assert.deepEqual(stamp("core", "job-started", {}), terminal);
});

test("inside a job every event is the job's, whatever answers, holds run.pid or names a channel", (t) => {
	const home = temporaryFolder();
	const stamp = stamper(home, JOB, () => [{ actor: "coordinator", on: [1] }], "owner");
	const lock = takeLock(join(home, "run.pid"));
	assert.ok("release" in lock);
	t.after(lock.release);
	const job = { actor: `job:${JOB}` };
	assert.deepEqual([stamp("core", "job-ended", {}), stamp("telegram", "message-received", { channel: "telegram" }), stamp("schedule", "notice", {})], [job, job, job]);
	assert.deepEqual(stamp("core", "coordinator-replied", { answers: [7] }), { ...job, on: [7] });
});

// A loaded config with its own home folder and no env file, as host.test.ts makes it.
function config(plugins: readonly unknown[]): LoadedConfig {
	const folder = temporaryFolder();
	const jobs = { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, unsandboxed: true, cpu: 1, memory: "70%" };
	const core = { home: join(folder, ".arthur"), envFile: join(folder, "env"), agent: { command: "omp" }, timeZone: "UTC", quietHours: undefined, jobs };
	return { path: join(folder, "arthur.config.ts"), core, plugins };
}

// `orchestration` answers `/ping` with an event of its own, `telegram` is the channel that hands the command over.
async function load(job?: string): Promise<{ readonly channel: Host; readonly home: string }> {
	let channel: Host | undefined;
	const doc = new URL("../docs/commands/version.md", import.meta.url);
	const ping = { name: "orchestration", setup: (host: Host) => host.commands.register({ name: "ping", doc, run: () => 0, phone: { about: "Ping.", reply: () => (host.events.emit("ponged", null), "pong") } }) };
	const loaded = config([ping, { name: "telegram", setup: (host: Host) => void (channel = host) }]);
	await loadPlugins(loaded, {}, undefined, job);
	return { channel: channel as Host, home: loaded.core.home };
}

test("a /command a channel hands over is logged as phone-command, the owner on that channel, before the events of its reply", async () => {
	const { channel, home } = await load();
	assert.equal(await channel.commands.route("/ping now", { channel: "telegram", place: "12", instance: "work" }), "pong");
	assert.equal(await channel.commands.route("/nothing"), "unknown command /nothing; phone commands: /ping");
	const terminal = { actor: `user:terminal:${userInfo().username}` };
	assert.deepEqual(
		readEvents(home, 1).map(({ plugin, by, name, data }) => [plugin, by, name, data]),
		[
			["telegram", { actor: "user:telegram/work" }, "phone-command", { channel: "telegram", place: "12", instance: "work", text: "/ping now" }],
			["orchestration", terminal, "ponged", null],
			["telegram", { actor: "user:telegram" }, "phone-command", { channel: "telegram", text: "/nothing" }],
		],
	);
});

test("inside a job a routed command logs no phone-command, and every event is stamped the job's", async () => {
	const { channel, home } = await load(JOB);
	assert.equal(await channel.commands.route("/ping", { channel: "telegram" }), "pong");
	assert.deepEqual(readEvents(home, 1).map(({ by, name }) => [by, name]), [[{ actor: `job:${JOB}` }, "ponged"]]);
});

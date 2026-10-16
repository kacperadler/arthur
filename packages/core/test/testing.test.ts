import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative } from "node:path";
import { test } from "node:test";
import type { Plugin } from "@arthur/core/plugin";
import { fakeHost } from "@arthur/core/testing";

// A plugin as a later one will be: it provides one name and calls another in its setup.
const schedule = (options: { readonly at: string }): Plugin => ({
	name: "schedule",
	options,
	setup(host) {
		host.provide("schedule.register", (id: string) => `${id} at ${options.at}`);
		host.call("jobs.place", "AR1");
		host.collect("prompt", "worker");
	},
});

test("the fake host records what a plugin provides and calls, and lets the test drive both sides", async () => {
	const fake = fakeHost({ name: "schedule", options: { at: "08:00" }, env: { ARTHUR_SCHEDULE_TOKEN: "t" } });
	fake.provide("jobs.place", (job: string) => `local for ${job}`);
	await schedule({ at: "08:00" }).setup(fake.host);
	assert.deepEqual(fake.provided, ["schedule.register"]);
	assert.deepEqual(fake.calls, [
		{ kind: "call", name: "jobs.place", args: ["AR1"] },
		{ kind: "collect", name: "prompt", args: ["worker"] },
	]);
	assert.equal(fake.call("schedule.register", "audit"), "audit at 08:00");
	assert.deepEqual(fake.collect("schedule.register", "retro"), ["retro at 08:00"]);
	assert.deepEqual(fake.host.options, { at: "08:00" });
	assert.deepEqual(fake.host.env, { ARTHUR_SCHEDULE_TOKEN: "t" });
	assert.equal(fake.host.name, "schedule");
});

test("the fake host's folder is the plugin's own, empty, inside the kit's temporary folder", () => {
	const one = fakeHost({ name: "telegram" });
	const two = fakeHost({ name: "telegram" });
	assert.ok(existsSync(one.host.folder));
	assert.equal(one.host.folder.split("/").at(-1), "telegram");
	assert.notEqual(one.host.folder, two.host.folder);
	assert.ok(!relative(tmpdir(), one.host.folder).startsWith(".."), one.host.folder);
});

test("the fake host refuses a call nobody provides, naming the plugin, as the real host does", async () => {
	const fake = fakeHost({ name: "schedule", options: { at: "08:00" } });
	await assert.rejects(async () => schedule({ at: "08:00" }).setup(fake.host), {
		message: 'plugin schedule: call("jobs.place"): no plugin provides it',
	});
	assert.throws(() => fake.call("health"), { message: 'plugin test: call("health"): no plugin provides it' });
});

test("the fake host's clock stands still, UTC at 2026-01-01T00:00:00Z unless given, until the test moves it", () => {
	const plain = fakeHost({ name: "schedule" });
	assert.equal(plain.host.clock.timeZone, "UTC");
	assert.equal(plain.host.clock.now().toISOString(), "2026-01-01T00:00:00.000Z");
	assert.equal(plain.host.clock.isQuiet(), false);
	const start = new Date("2026-07-01T21:00:00+02:00");
	const fake = fakeHost({ name: "telegram", timeZone: "Europe/Warsaw", quietHours: { from: "22:00", to: "07:30" }, now: start });
	const { clock } = fake.host;
	assert.equal(clock.now().toISOString(), start.toISOString());
	assert.equal(clock.isQuiet(), false);
	assert.equal(clock.next("22:00").toISOString(), "2026-07-01T20:00:00.000Z");
	fake.setNow(new Date("2026-07-01T22:00:00+02:00"));
	assert.equal(clock.now().toISOString(), "2026-07-01T20:00:00.000Z");
	assert.equal(clock.isQuiet(), true);
	assert.equal(clock.next("22:00").toISOString(), "2026-07-02T20:00:00.000Z");
	assert.deepEqual(clock.local(), { date: "2026-07-01", time: "22:00", day: "wed" });
	assert.equal(plain.host.clock.now().toISOString(), "2026-01-01T00:00:00.000Z", "each fake host has its own clock");
});

test("the fake host delivers the test's events to the plugin and lists what the plugin emitted, nested ones in their order", () => {
	const fake = fakeHost({ name: "delivery" });
	fake.host.events.on("review-ended", (event) => {
		fake.host.events.emit("ticket-moved", { id: event.data, to: "done" });
		fake.host.events.emit("merge-due", { id: event.data });
	});
	fake.host.events.on("ticket-moved", (event) => void fake.host.events.emit("changelog-due", event.seq));
	assert.equal(fake.emit("review-ended", "AR1").plugin, "test");
	assert.deepEqual(
		fake.emitted.map(({ seq, plugin, name, data }) => ({ seq, plugin, name, data })),
		[
			{ seq: 2, plugin: "delivery", name: "ticket-moved", data: { id: "AR1", to: "done" } },
			{ seq: 3, plugin: "delivery", name: "merge-due", data: { id: "AR1" } },
			{ seq: 4, plugin: "delivery", name: "changelog-due", data: 2 },
		],
	);
});

// A child process loads the kit with live-looking variables, prints what it sees, and exits as the script says.
function child(script: string): { readonly seen: { arthur: string[]; tmux: string | null; folder: string }; readonly status: number | null } {
	const kit = import.meta.resolve("@arthur/core/testing");
	const code = `const { temporaryFolder } = await import(${JSON.stringify(kit)});
		const folder = temporaryFolder();
		console.log(JSON.stringify({ arthur: Object.keys(process.env).filter((key) => key.startsWith("ARTHUR_")), tmux: process.env.TMUX ?? process.env.TMUX_PANE ?? null, folder, socketDir: process.env.TMUX_TMPDIR }));
		${script}`;
	const env = { ...process.env, ARTHUR_TELEGRAM_BOT_TOKEN: "live-token", ARTHUR_HOME: "/live/.arthur", TMUX: "/tmp/tmux-1000/default,1,0", TMUX_PANE: "%1" };
	const run = spawnSync(process.execPath, ["--input-type=module", "-e", code], { env, encoding: "utf8" });
	const seen = JSON.parse(run.stdout.trim()) as { arthur: string[]; tmux: string | null; folder: string; socketDir: string };
	assert.equal(dirname(seen.folder), seen.socketDir, "tmux's default socket lives in the kit's folder");
	return { seen, status: run.status };
}

test("the kit clears every ARTHUR_ and tmux variable, and removes its folders when the process exits, passed or failed", () => {
	for (const script of ["", "process.exitCode = 1;", 'throw new Error("a failed test");']) {
		const { seen, status } = child(script);
		assert.deepEqual(seen.arthur, []);
		assert.equal(seen.tmux, null);
		assert.equal(existsSync(seen.folder), false, `${seen.folder} is left after: ${script || "a pass"}`);
		assert.equal(status, script === "" ? 0 : 1);
	}
});

test("a tmux command under the kit reaches no live server", { skip: !hasTmux() && "tmux is not installed" }, () => {
	const run = spawnSync("tmux", ["list-sessions"], { encoding: "utf8" });
	assert.notEqual(run.status, 0, `tmux listed live sessions: ${run.stdout}`);
	assert.match(run.stderr, /no server running|error connecting/);
});

function hasTmux(): boolean {
	try {
		execFileSync("tmux", ["-V"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Event } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { loadPlugins } from "../src/host.ts";
import type { Plugin } from "../src/plugin.ts";
import { temporaryFolder } from "../src/testing.ts";

const logOf = (home: string) => join(home, "events.jsonl");
const brief = (events: readonly Event[]) => events.map(({ seq, plugin, name, data }) => ({ seq, plugin, name, data }));

test("each event is one line with its sequence number, time and plugin; subscribers and readers get it as logged", async () => {
	const home = join(temporaryFolder(), ".arthur");
	const seen: Event[] = [];
	const plugin = (name: string, setup: Plugin["setup"]): Plugin => ({ name, setup });
	const jobs = { timeoutMinutes: 120, budgetUsd: 2, cpu: 1, memory: "70%" };
	const core = { home, envFile: join(home, "env"), agent: { command: "omp" }, timeZone: "UTC", quietHours: undefined, jobs };
	const before = new Date().toISOString();
	await loadPlugins({
		path: join(home, "arthur.config.ts"),
		core,
		plugins: [
			plugin("orchestration", (host) => host.events.on("job-ended", (event) => void seen.push(event))),
			plugin("telegram", (host) => {
				host.events.emit("job-ended", { id: "AR1", at: new Date(0), skipped: undefined });
				host.events.emit("message-received", { text: "hi" });
				host.events.emit("job-ended", { id: "AR2" });
			}),
		],
	}, {});
	const lines = readFileSync(logOf(home), "utf8").split("\n");
	assert.equal(lines.length, 4, "three lines, each ended by a line break");
	const logged = lines.slice(0, 3).map((line) => JSON.parse(line) as Event);
	assert.deepEqual(brief(logged), [
		{ seq: 1, plugin: "telegram", name: "job-ended", data: { id: "AR1", at: "1970-01-01T00:00:00.000Z" } },
		{ seq: 2, plugin: "telegram", name: "message-received", data: { text: "hi" } },
		{ seq: 3, plugin: "telegram", name: "job-ended", data: { id: "AR2" } },
	]);
	for (const { time } of logged) assert.ok(time >= before && time <= new Date().toISOString(), time);
	assert.deepEqual(seen, [logged[0], logged[2]]);
	assert.deepEqual(eventBus(home).read(1), logged);
});

test("subscribers get events in emit order; an event emitted inside a handler is delivered after the current one", () => {
	const bus = eventBus(temporaryFolder());
	const order: string[] = [];
	bus.on("schedule", "ticket-moved", (event) => {
		order.push(`schedule got ${event.seq}`);
		if (event.seq === 1) bus.emit("schedule", "ticket-moved", "inner");
	});
	bus.on("telegram", "ticket-moved", (event) => void order.push(`telegram got ${event.seq}`));
	const outer = bus.emit("delivery", "ticket-moved", "outer");
	bus.emit("delivery", "ticket-moved", "last");
	assert.equal(outer.seq, 1);
	assert.deepEqual(order, ["schedule got 1", "telegram got 1", "schedule got 2", "telegram got 2", "schedule got 3", "telegram got 3"]);
	assert.deepEqual(bus.read(1).map((event) => event.data), ["outer", "inner", "last"]);
});

test("a handler that throws or rejects does not stop the others and is logged with its plugin's name", async (t) => {
	const logged = t.mock.method(console, "error", () => undefined);
	const bus = eventBus(temporaryFolder());
	const got: string[] = [];
	bus.on("schedule", "job-ended", () => {
		throw new Error("no file");
	});
	bus.on("session", "job-ended", () => Promise.reject(new Error("no session")));
	bus.on("telegram", "job-ended", (event) => void got.push(`telegram ${event.seq}`));
	bus.emit("orchestration", "job-ended", { id: "AR1" });
	bus.emit("orchestration", "job-ended", { id: "AR2" });
	assert.deepEqual(got, ["telegram 1", "telegram 2"]);
	await new Promise(setImmediate);
	assert.deepEqual(logged.mock.calls.map((call) => call.arguments[0]).sort(), [
		"plugin schedule: handler of job-ended (event 1) failed: no file",
		"plugin schedule: handler of job-ended (event 2) failed: no file",
		"plugin session: handler of job-ended (event 1) failed: no session",
		"plugin session: handler of job-ended (event 2) failed: no session",
	]);
});

test("two processes appending at once never interleave a line nor repeat a sequence number", async () => {
	const home = temporaryFolder();
	const events = JSON.stringify(import.meta.resolve("../src/event-log.ts"));
	const count = 300;
	// Both start at one moment and write lines of 6 to 7 KB, more than one atomic pipe write. The child imports the core by
	// its path, given at run time.
	const startAt = Date.now() + 1000;
	const writer = (plugin: string) => {
		const { promise, resolve } = Promise.withResolvers<number | null>();
		const code = `const { appendEvent } = await import(${events});
			while (Date.now() < ${startAt});
			for (let i = 0; i < ${count}; i++) appendEvent(${JSON.stringify(home)}, "${plugin}", "tick", { i, pad: "${plugin}".repeat(1000) });`;
		spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: "inherit" }).on("exit", resolve);
		return promise;
	};
	assert.deepEqual(await Promise.all([writer("daemon"), writer("command")]), [0, 0]);
	const lines = readFileSync(logOf(home), "utf8").split("\n");
	assert.equal(lines.pop(), "");
	const logged = lines.map((line) => JSON.parse(line) as Event);
	assert.deepEqual(logged.map((event) => event.seq), Array.from({ length: 2 * count }, (_, index) => index + 1));
	for (const plugin of ["daemon", "command"]) {
		const own = logged.filter((event) => event.plugin === plugin).map((event) => event.data);
		const written = Array.from({ length: count }, (_, i) => ({ i, pad: plugin.repeat(1000) }));
		assert.deepEqual(own, written, `${plugin}'s events, in its order`);
	}
	const plugins = logged.map((event) => event.plugin);
	assert.ok(plugins.indexOf("daemon") < plugins.lastIndexOf("command") && plugins.indexOf("command") < plugins.lastIndexOf("daemon"), "the two ran at once");
});

test("a torn last line after a crash is skipped on read, and the next sequence number continues after it", () => {
	const home = temporaryFolder();
	const bus = eventBus(home);
	bus.emit("orchestration", "job-started", { id: "AR1" });
	bus.emit("orchestration", "job-started", { id: "AR2" });
	appendFileSync(logOf(home), '{"seq":3,"time":"2026-10-16T10:00:00.000Z","plugin":"orchestration","na');
	assert.deepEqual(bus.read(1).map((event) => event.seq), [1, 2]);
	assert.equal(bus.emit("orchestration", "job-ended", { id: "AR1" }).seq, 3);
	assert.deepEqual(brief(bus.read(1)).at(-1), { seq: 3, plugin: "orchestration", name: "job-ended", data: { id: "AR1" } });
	assert.equal(readFileSync(logOf(home), "utf8").split("\n").length, 5, "the torn line kept on a line of its own");
	assert.equal(bus.emit("orchestration", "job-ended", { id: "AR2" }).seq, 4);
});

test("lines broken by hand are skipped; the number continues after the last event, even one longer than a read chunk", () => {
	const home = temporaryFolder();
	const bus = eventBus(home);
	const long = "x".repeat(200_000);
	bus.emit("orchestration", "job-started", { long });
	writeFileSync(logOf(home), `${readFileSync(logOf(home), "utf8")}null\n[]\n{"seq":"2","time":"t","plugin":"p","name":"n"}\n\n{"seq":0,"time":"t","plugin":"p","name":"n"}\n`);
	assert.equal(bus.emit("orchestration", "job-ended", { long }).seq, 2);
	assert.equal(bus.emit("orchestration", "job-ended", {}).seq, 3);
	assert.deepEqual(bus.read(1).map((event) => event.seq), [1, 2, 3]);
});

test("reading from a sequence number gives that event on; past the end, or before any event was logged, nothing", () => {
	const bus = eventBus(temporaryFolder());
	assert.deepEqual(bus.read(1), []);
	for (const name of ["a", "b", "c"]) bus.emit("orchestration", name, null);
	assert.deepEqual(bus.read(2).map((event) => event.name), ["b", "c"]);
	assert.deepEqual(bus.read(3).map((event) => event.name), ["c"]);
	assert.deepEqual(bus.read(4), []);
	assert.deepEqual(bus.read(1000), []);
});

test("a following bus delivers what another writer appends after it began, in order, and its own events once, at emit", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	const home = temporaryFolder();
	const daemon = eventBus(home);
	const command = eventBus(home);
	command.emit("core", "ticket-moved", "before the follow");
	const got: string[] = [];
	daemon.on("telegram", "ticket-moved", (event) => {
		got.push(`${event.seq} ${event.plugin} ${event.data}`);
		if (event.data === "by the command") daemon.emit("delivery", "ticket-moved", "the reaction");
	});
	t.after(daemon.follow(100));
	daemon.emit("orchestration", "ticket-moved", "own");
	assert.deepEqual(got, ["2 orchestration own"], "its own at once, before any tick");
	command.emit("core", "ticket-moved", "by the command");
	command.emit("core", "job-started", "nobody listens");
	command.emit("core", "ticket-moved", "second");
	t.mock.timers.tick(99);
	assert.deepEqual(got, ["2 orchestration own"], "nothing between ticks");
	t.mock.timers.tick(1);
	// The reaction, emitted inside a handler, waits behind the events already read.
	assert.deepEqual(got, ["2 orchestration own", "3 core by the command", "5 core second", "6 delivery the reaction"]);
	t.mock.timers.tick(100);
	assert.equal(got.length, 4, "its own reaction, read back from the log, is not delivered again");
});

test("a following bus waits for a line's end, follows a log cut or deleted by hand from its new end, and stops", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	const home = temporaryFolder();
	const daemon = eventBus(home);
	const got: number[] = [];
	daemon.on("telegram", "notice", (event) => void got.push(event.seq));
	const stop = daemon.follow(10);
	const line = '{"seq":1,"time":"2026-10-16T10:00:00.000Z","plugin":"session","name":"notice","data":"up"}\n';
	appendFileSync(logOf(home), line.slice(0, 40));
	t.mock.timers.tick(10);
	assert.deepEqual(got, [], "half a line is no event yet");
	appendFileSync(logOf(home), line.slice(40));
	t.mock.timers.tick(10);
	assert.deepEqual(got, [1]);

	const command = eventBus(home);
	writeFileSync(logOf(home), "");
	t.mock.timers.tick(10);
	command.emit("session", "notice", "after the cut");
	t.mock.timers.tick(10);
	assert.deepEqual(got, [1, 1], "numbers start again in the cut log");
	rmSync(logOf(home));
	t.mock.timers.tick(10);
	command.emit("session", "notice", "after the delete");
	t.mock.timers.tick(10);
	assert.deepEqual(got, [1, 1, 1]);

	stop();
	command.emit("session", "notice", "after the stop");
	t.mock.timers.tick(100);
	assert.deepEqual(got, [1, 1, 1], "no check after the stop");
	daemon.emit("orchestration", "notice", "own after the stop");
	assert.deepEqual(got, [1, 1, 1, 2, 3], "an own emit delivers first what another process appended, in the log's order");
});

const deliveredOf = (home: string) => join(home, "events.delivered");

test("a bus that follows again delivers, in order and once, what came after the last event it delivered", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	const home = temporaryFolder();
	const command = eventBus(home);
	const got: string[] = [];
	const daemon = () => {
		const bus = eventBus(home);
		bus.on("telegram", "ticket-moved", (event) => {
			got.push(`${event.seq} ${event.data}`);
			if (event.data === "b") bus.emit("delivery", "ticket-moved", "reaction to b");
		});
		return bus;
	};
	command.emit("core", "ticket-moved", "before any daemon");
	const first = daemon();
	const stop = first.follow(10);
	assert.equal(existsSync(deliveredOf(home)), false, "a first start begins at the log's end and keeps nothing yet");
	command.emit("core", "ticket-moved", "a");
	t.mock.timers.tick(10);
	first.emit("orchestration", "job-started", "nobody listens");
	assert.deepEqual(got, ["2 a"]);
	assert.equal(readFileSync(deliveredOf(home), "utf8"), "3\n", "an event nobody listens to counts as delivered");
	stop();

	command.emit("core", "ticket-moved", "b");
	command.emit("core", "ticket-moved", "c");
	const second = daemon();
	second.emit("schedule", "ticket-moved", "own, before the follow");
	t.after(second.follow(10));
	assert.deepEqual(got, ["2 a", "6 own, before the follow"], "the replay waits for the first check");
	t.mock.timers.tick(10);
	assert.deepEqual(got, ["2 a", "6 own, before the follow", "4 b", "5 c", "7 reaction to b"]);
	assert.equal(readFileSync(deliveredOf(home), "utf8"), "7\n");

	const third = daemon();
	t.after(third.follow(10));
	t.mock.timers.tick(30);
	assert.equal(got.length, 5, "a second restart delivers nothing again");
});

test("a kept number past the log's last event, or no whole number, follows from the log's end with one warning", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	const warned = t.mock.method(console, "error", () => {});
	for (const [text, warning] of [
		["9\n", "holds 9, past the log's last event 2; following the event log from its end"],
		["", "holds no whole number; following the event log from its end"],
		["1.5", "holds no whole number; following the event log from its end"],
		["-1", "holds no whole number; following the event log from its end"],
		["1e3", "holds no whole number; following the event log from its end"],
		["99999999999999999999", "holds no whole number; following the event log from its end"],
		["2", undefined],
	] as const) {
		const home = temporaryFolder();
		const command = eventBus(home);
		command.emit("core", "notice", "logged before");
		command.emit("core", "notice", "logged before");
		writeFileSync(deliveredOf(home), text);
		const daemon = eventBus(home);
		const got: number[] = [];
		daemon.on("telegram", "notice", (event) => void got.push(event.seq));
		const stop = daemon.follow(10);
		command.emit("core", "notice", "after the start");
		t.mock.timers.tick(10);
		stop();
		assert.deepEqual(got, [3], `with ${JSON.stringify(text)}: from the end`);
		assert.deepEqual(warned.mock.calls.map((call) => call.arguments[0]), warning === undefined ? [] : [`arthur run: ${deliveredOf(home)} ${warning}`]);
		assert.equal(readFileSync(deliveredOf(home), "utf8"), "3\n");
		warned.mock.resetCalls();
	}
});

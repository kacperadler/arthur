import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, type FakeHost, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { checkOptions, type SessionOptions, session } from "../src/session.ts";

const ARTHUR = "This message comes from Arthur, not the owner; your reply goes to the owner only if one of their messages joins this turn.";
const HANDOFF = "Work in progress: AR0143, its worker runs.\nNext: review its branch.\nUnanswered: merge AR0140? (asked at 12:40)";

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

const lines = (file: string): Record<string, unknown>[] => (existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);

// The plugin on a fake host in Warsaw at `now`, started as `arthur run` starts it, its printed lines caught; stopped at the end.
async function load(t: TestContext, options: SessionOptions, now: string) {
	const [out, err] = [[] as string[], [] as string[]];
	t.mock.method(console, "log", (text: string) => void out.push(text));
	t.mock.method(console, "error", (text: string) => void err.push(text));
	const fake = fakeHost({ name: "session", options, timeZone: "Europe/Warsaw", now: new Date(now) });
	const plugin = session(options);
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	const file = join(fake.host.folder, "request.json");
	return {
		fake,
		out,
		err,
		file,
		handoff: join(fake.host.folder, "handoff.md"),
		start: () => plugin.start?.(),
		at: (when: string) => fake.setNow(new Date(when)),
		request: () => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : undefined),
	};
}

// The coordinator: the fake agent playing `run` with the extension the plugin gives orchestration, after `before`'s, and its
// variables; killed at the end. `open(name)` lets a step `{ waitFor: gate(name) }` go on.
function coordinator(t: TestContext, fake: FakeHost, run: (gate: (name: string) => string) => AgentRun, before: readonly string[] = []) {
	const gates = temporaryFolder();
	const agent = fakeAgent(run((name) => join(gates, name)));
	const [extension] = fake.collect<{ file: string; env: Record<string, string> }>("coordinator.extension");
	assert.ok(extension);
	const child = spawn(agent, [...before.flatMap((file) => ["-e", file]), "-e", extension.file], { env: { ...process.env, ...extension.env }, stdio: "ignore" });
	t.after(() => {
		writeFileSync(join(gates, "release"), "");
		child.kill();
	});
	return {
		open: (name: string) => writeFileSync(join(gates, name), ""),
		messages: () => lines(join(dirname(agent), "messages.jsonl")),
		compactions: () => lines(join(dirname(agent), "compactions.jsonl")),
	};
}

test("at a compactAt slot the coordinator writes its handoff, the conversation is compacted, and the compacted conversation starts by reading it", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 60 }, "2026-10-18T12:59:00+02:00");
	const agent = coordinator(t, box.fake, (gate) => ({
		steps: [{ prompt: true }, { waitFor: gate("written") }, { message: "Handoff written." }, { end: true }, { prompt: true }, { message: "Going on." }, { end: true }, { waitFor: gate("release") }],
	}));
	await box.start();
	await sleep(1200);
	assert.equal(box.request(), undefined, "nothing before the slot");
	box.at("2026-10-18T13:00:00+02:00");
	await until("the handoff request", () => agent.messages().length === 1);
	const ask = `[Arthur] Your conversation is compacted after this turn. First write your handoff to ${box.handoff}, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when you asked it. The compacted conversation starts by reading it. ${ARTHUR}`;
	assert.deepEqual(agent.messages()[0], { content: ask, options: { attribution: "agent" }, step: 0 });
	assert.equal(typeof box.request()?.pid, "number", "the agent took the request");
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	agent.open("written");
	await until("the outcome", () => box.out.length === 1);
	assert.deepEqual(box.out, ["session: compact: done; the compacted conversation starts by reading the handoff"]);
	// Compacted after the handoff turn ended (step 3), while the agent waits for its next prompt (step 4), which reads the handoff.
	assert.deepEqual(agent.compactions(), [{ instructions: null, step: 4 }]);
	await until("the read-back turn", () => agent.messages().length === 2);
	const read = `[Arthur] Your conversation was just compacted. Before that you wrote this handoff (${box.handoff}); go on from it:\n\n${HANDOFF}\n\n${ARTHUR}`;
	assert.deepEqual(agent.messages()[1], { content: read, options: { attribution: "agent" }, step: 4 });
	await until("the request gone", () => box.request() === undefined);
	assert.equal(readFileSync(join(box.fake.host.folder, "handoff-read"), "utf8"), String(statSync(box.handoff).mtimeMs), "noted as read, so no start reads it again");
	assert.deepEqual(box.err, []);
});

test("a handoff write that fails withdraws the compaction with one line and leaves the conversation as it was", async (t) => {
	for (const ending of [{ message: "Nothing to write." }, { message: "", stopReason: "error" as const, error: "529 overloaded" }]) {
		const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 60 }, "2026-10-18T12:59:00+02:00");
		// One the conversation read already, so its start does not read it again.
		writeFileSync(box.handoff, "An older handoff.\n");
		writeFileSync(join(box.fake.host.folder, "handoff-read"), String(statSync(box.handoff).mtimeMs));
		const agent = coordinator(t, box.fake, (gate) => ({ steps: [{ prompt: true }, ending, { end: true }, { waitFor: gate("release") }] }));
		await box.start();
		box.at("2026-10-18T13:00:00+02:00");
		await until("the outcome", () => box.out.length === 1);
		const why = ending.stopReason === "error" ? " (529 overloaded)" : "";
		assert.deepEqual(box.out, [`session: compact: skipped, handoff not written: no new handoff when the coordinator's turn ended${why}`]);
		assert.deepEqual(agent.compactions(), [], "not compacted");
		assert.equal(agent.messages().length, 1, "nothing read back");
		assert.equal(readFileSync(box.handoff, "utf8"), "An older handoff.\n");
		await until("the request gone", () => box.request() === undefined);
	}
});

test("an empty handoff is not read back; a compaction that fails says so and reads nothing back", async (t) => {
	for (const [run, line] of [
		[{}, "session: compact: done; the handoff is empty, so nothing is read back"],
		[{ compactError: "Compaction failed: 500 from the model\nat line 2" }, "session: compact: failed: Compaction failed: 500 from the model"],
	] as const) {
		const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 60 }, "2026-10-18T12:59:00+02:00");
		const agent = coordinator(t, box.fake, (gate) => ({ ...run, steps: [{ prompt: true }, { waitFor: gate("written") }, { message: "Done." }, { end: true }, { waitFor: gate("release") }] }));
		await box.start();
		box.at("2026-10-18T13:00:00+02:00");
		await until("the handoff request", () => agent.messages().length === 1);
		writeFileSync(box.handoff, run.compactError === undefined ? " \n\n" : HANDOFF);
		agent.open("written");
		await until("the outcome", () => box.out.length === 1);
		assert.deepEqual(box.out, [line]);
		assert.equal(agent.compactions().length, run.compactError === undefined ? 1 : 0);
		await sleep(700);
		assert.equal(agent.messages().length, 1, "nothing read back");
	}
});

test("a session busy for compactWaitSeconds withdraws the request with one line, and the handoff is never asked for", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 1 }, "2026-10-18T12:59:00+02:00");
	// Another extension starts a turn that runs until the test ends.
	const busy = join(temporaryFolder(), "busy.ts");
	writeFileSync(busy, `export default (pi) => pi.on("session_start", () => pi.sendUserMessage("Busy."));\n`);
	const agent = coordinator(t, box.fake, (gate) => ({ steps: [{ prompt: true }, { waitFor: gate("release") }] }), [busy]);
	await until("the busy turn", () => agent.messages().length === 1);
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the outcome", () => box.out.length === 1);
	assert.deepEqual(box.out, ["session: compact: skipped, session busy for 1 s"]);
	assert.deepEqual(agent.messages().map((message) => message.content), ["Busy."]);
	assert.deepEqual(agent.compactions(), []);
});

test("with no session running a slot does nothing: its request is dropped without a word after compactWaitSeconds", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 1 }, "2026-10-18T12:59:00+02:00");
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the request", () => box.request() !== undefined);
	assert.deepEqual({ ...box.request(), asked: 0 }, { then: "compact", slot: "13:00", asked: 0, waitSeconds: 1 });
	await until("the request gone", () => box.request() === undefined);
	assert.deepEqual([box.out, box.err], [[], []]);
});

test("a slot missed while Arthur was down is skipped, not run late, and a request left by the last run is dropped", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 60 }, "2026-10-18T13:05:00+02:00");
	writeFileSync(box.file, JSON.stringify({ then: "compact", slot: "08:00", asked: Date.now(), waitSeconds: 60 }));
	await box.start();
	assert.equal(box.request(), undefined);
	await sleep(1200);
	assert.equal(box.request(), undefined, "13:00 passed before the start");
	box.at("2026-10-19T12:59:00+02:00");
	await sleep(1200);
	assert.equal(box.request(), undefined);
	box.at("2026-10-19T13:00:00+02:00");
	await until("the next day's request", () => box.request()?.slot === "13:00");
});

test("two slots close together never queue two compactions", async (t) => {
	const box = await load(t, { compactAt: ["13:00", "13:01", "13:02"], compactWaitSeconds: 600 }, "2026-10-18T12:00:00+02:00");
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the request", () => box.request() !== undefined);
	const first = box.request();
	box.at("2026-10-18T13:01:00+02:00");
	await sleep(1200);
	assert.deepEqual(box.request(), first, "13:01 while 13:00's still runs: no second");
	// The 13:00 compaction done; 13:01 was not kept for later, and 13:02 passing together with later times asks once.
	rmSync(box.file);
	await sleep(1200);
	assert.equal(box.request(), undefined);
	box.at("2026-10-18T18:00:00+02:00");
	await until("one request", () => box.request() !== undefined);
	assert.equal(box.request()?.slot, "13:02");
	rmSync(box.file);
	await sleep(1200);
	assert.equal(box.request(), undefined, "the next slot is tomorrow's 13:00");
});

test("daylight saving days: 02:30 in the spring gap comes at 03:00, and in the autumn repeat once", async (t) => {
	const spring = await load(t, { compactAt: ["02:30"], compactWaitSeconds: 600 }, "2026-03-29T00:00:00Z");
	await spring.start();
	spring.at("2026-03-29T00:59:00Z"); // 01:59 CET
	await sleep(1200);
	assert.equal(spring.request(), undefined);
	spring.at("2026-03-29T01:00:00Z"); // 03:00 CEST, the first minute after the jump
	await until("the spring request", () => spring.request()?.slot === "02:30");
	const autumn = await load(t, { compactAt: ["02:30"], compactWaitSeconds: 600 }, "2026-10-25T00:00:00Z");
	await autumn.start();
	autumn.at("2026-10-25T00:30:00Z"); // 02:30 CEST, the first pass
	await until("the autumn request", () => autumn.request() !== undefined);
	rmSync(autumn.file);
	autumn.at("2026-10-25T01:30:00Z"); // 02:30 CET, the repeat
	await sleep(1200);
	assert.equal(autumn.request(), undefined, "the repeat does not compact again");
	autumn.at("2026-10-26T01:30:00Z"); // the next day's 02:30 CET
	await until("the next day's request", () => autumn.request() !== undefined);
});

test("a request whose agent is gone, or a file that is not a request, is dropped", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 600 }, "2026-10-18T12:00:00+02:00");
	await box.start();
	const gone = spawnSync(process.execPath, ["-e", ""]).pid;
	writeFileSync(box.file, JSON.stringify({ then: "compact", slot: "13:00", asked: Date.now(), waitSeconds: 600, pid: gone }));
	await until("the request of a gone agent dropped", () => box.request() === undefined);
	assert.deepEqual([box.out, box.err], [[], []]);
	writeFileSync(box.file, "{ torn");
	await until("the torn file dropped", () => !existsSync(box.file));
	assert.deepEqual(box.err, [`session: ${box.file} is not a request, so it is dropped: { torn`]);
});

test("the options: compactAt times, compactWaitSeconds and the fresh start's, each refused naming its path, and no option of a later entry", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ compactAt: [], compactWaitSeconds: 1, freshAt: "00:00", freshRetryMinutes: 1, freshUntil: "00:00" }), []);
	assert.deepEqual(checkOptions({ compactAt: ["08:00", "23:59", "00:00"], compactWaitSeconds: 1800, freshAt: "23:00", freshRetryMinutes: 15, freshUntil: "03:00" }), []);
	assert.deepEqual(checkOptions({ compactAt: "13:00", compactWaitSeconds: 0, restartGuard: true }), [
		{ path: "restartGuard", problem: "unknown option; options: compactAt, compactWaitSeconds, freshAt, freshRetryMinutes, freshUntil" },
		{ path: "compactAt", problem: 'expected a list of times "HH:MM", got "13:00"' },
		{ path: "compactWaitSeconds", problem: "expected a whole number of seconds of at least 1, got 0" },
	]);
	for (const [freshUntil, freshRetryMinutes] of [["3:00", 0], ["24:00", -15], [300, 1.5], [undefined, "15"]] as const)
		assert.deepEqual(checkOptions({ freshAt: "23:00", freshUntil, freshRetryMinutes }), [
			...(freshUntil === undefined ? [] : [{ path: "freshUntil", problem: `expected a time "HH:MM" from 00:00 to 23:59, got ${JSON.stringify(freshUntil)}` }]),
			{ path: "freshRetryMinutes", problem: `expected a whole number of minutes of at least 1, got ${JSON.stringify(freshRetryMinutes)}` },
		]);
	assert.deepEqual(checkOptions({ freshAt: "11pm" }), [{ path: "freshAt", problem: 'expected a time "HH:MM" from 00:00 to 23:59, got "11pm"' }]);
	assert.deepEqual(checkOptions({ compactAt: ["8:00", "24:00", 13, "13:00"], compactWaitSeconds: 1.5 }), [
		{ path: "compactAt[0]", problem: 'expected a time "HH:MM" from 00:00 to 23:59, got "8:00"' },
		{ path: "compactAt[1]", problem: 'expected a time "HH:MM" from 00:00 to 23:59, got "24:00"' },
		{ path: "compactAt[2]", problem: 'expected a time "HH:MM" from 00:00 to 23:59, got 13' },
		{ path: "compactWaitSeconds", problem: "expected a whole number of seconds of at least 1, got 1.5" },
	]);
});

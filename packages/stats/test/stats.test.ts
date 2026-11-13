import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeAgent, type FakeHost, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import sessionStats from "../src/session-extension.ts";
import { checkOptions, stats } from "../src/stats.ts";

// The stats plugin against the fake host: the lines of `runs.jsonl`, and the coordinator's extension. docs/stats.md.

const [W1, W2, W3] = ["2026-11-06-worker-0000000a", "2026-11-06-review-0000000b", "2026-11-06-worker-0000000c"];
// Each JSON line, a torn one (cut by a crash) left out.
const lines = (file: string): Record<string, unknown>[] =>
	(existsSync(file) ? readFileSync(file, "utf8") : "").split("\n").flatMap((line) => {
		try {
			return [JSON.parse(line)];
		} catch {
			return [];
		}
	});
const usage = (input: number, output: number, cost: number, messages = 1) => ({ messages, input, output, cacheRead: 0, cacheWrite: 0, cost });

// A job's record in the fake host's home, as the wrapper leaves it at a run's end.
function job(fake: FakeHost, id: string, files: Readonly<Record<string, string>> = {}): void {
	const folder = join(dirname(fake.host.folder), "jobs", id);
	mkdirSync(folder, { recursive: true });
	const record = { kind: "worker", project: "acme", state: "ended", reason: "finished", since: "2026-11-06T10:00:00.000Z", task: "Ticket: spec/features/AC0012-shop-cart/ticket.md\n", ran: "60", cost: "0.5000", ...files };
	for (const [name, text] of Object.entries(record)) writeFileSync(join(folder, name), text);
}

// The plugin set up on `fake` (a new one by default), with `runs.jsonl` already there unless `fresh`. A second load on `fake` is
// another process on the same home, which has a command registry of its own.
async function load(fake = fakeHost({ name: "stats" }), fresh = false) {
	if (!fresh && !existsSync(join(fake.host.folder, "runs.jsonl"))) writeFileSync(join(fake.host.folder, "runs.jsonl"), "");
	const plugin = stats();
	if (fake.commands.length === 0) await fake.setup(plugin);
	else await plugin.setup({ ...fake.host, commands: { ...fake.host.commands, register: () => {} } });
	return { fake, plugin, runs: () => lines(join(fake.host.folder, "runs.jsonl")), end: (id: string, state = "ended") => fake.emit("job-ended", { id, kind: "worker", project: "acme", state, reason: "finished" }) };
}

test("stats sets up on the fake host and refuses an option it does not know", async () => {
	await fakeHost({ name: "stats" }).setup(stats());
	assert.deepEqual(checkOptions({ nope: 1 }), [{ path: "nope", problem: "unknown option; stats has no options but enabled" }]);
});

test("a job-ended heard before start is written at start, a process that never starts writes nothing, and each run is what it added", async () => {
	const box = await load();
	job(box.fake, W1, { usage: JSON.stringify({ "anthropic/m1": usage(100, 20, 0.5) }) });
	const first = box.end(W1);
	assert.deepEqual(box.runs(), [], "nothing before start");
	await box.plugin.start?.();
	const base = { job: W1, kind: "worker", project: "acme", tickets: ["AC0012"], machine: "local", state: "ended", reason: "finished" };
	assert.deepEqual(box.runs(), [{ seq: first.seq, time: first.time, ...base, seconds: 60, cost: 0.5, usage: { "anthropic/m1": usage(100, 20, 0.5) } }]);
	// `arthur continue`: the record's totals grow, the second run's line holds what it added.
	job(box.fake, W1, { ran: "90", cost: "0.7500", usage: JSON.stringify({ "anthropic/m1": usage(150, 30, 0.6, 2), "ollama/qwen": usage(40, 4, 0) }) });
	const second = box.end(W1);
	assert.deepEqual(box.runs()[1], { seq: second.seq, time: second.time, ...base, seconds: 30, cost: 0.25, usage: { "anthropic/m1": usage(50, 10, 0.1), "ollama/qwen": usage(40, 4, 0) } });
	// The same run's second end (blocked, then stopped) adds 0.
	const third = box.end(W1);
	assert.deepEqual(box.runs()[2], { seq: third.seq, time: third.time, ...base, seconds: 0, cost: 0, usage: { "anthropic/m1": usage(0, 0, 0, 0), "ollama/qwen": usage(0, 0, 0, 0) } });
	// A command's process (`arthur stop`) sets the plugin up and never starts it.
	await load(box.fake);
	box.end(W1);
	assert.equal(box.runs().length, 4, "only the started plugin wrote");
});

test("an end whose seq the file already holds is skipped, as a replay after a crash; a torn last line stays apart", async () => {
	const box = await load();
	await box.plugin.start?.();
	job(box.fake, W1);
	const later = await load(box.fake);
	const event = box.end(W1);
	await later.plugin.start?.();
	assert.deepEqual(box.runs().map((line) => line.seq), [event.seq], "the replayed end is not written again");
	// A crash cut the last line: it is skipped, its seq counts for nothing, and the next line starts on a line of its own.
	const torn = await load();
	const runs = join(torn.fake.host.folder, "runs.jsonl");
	writeFileSync(runs, `{"job":"${W1}","seconds":60,"cost":0.5,"usage":{},"backfill":true}\n{"seq":90,"job":"`);
	job(torn.fake, W1);
	await torn.plugin.start?.();
	const next = torn.end(W1);
	assert.deepEqual(readFileSync(runs, "utf8").split("\n").slice(1), [`{"seq":90,"job":"`, JSON.stringify(torn.runs().at(-1)), ""]);
	assert.deepEqual([torn.runs().at(-1)?.seq, torn.runs().at(-1)?.cost], [next.seq, 0], "written, and the backfill line still counts for the job");
});

test("an end whose record is gone gives a missing line", async () => {
	const box = await load();
	await box.plugin.start?.();
	const event = box.end(W2, "blocked");
	assert.deepEqual(box.runs(), [{ seq: event.seq, time: event.time, job: W2, kind: "worker", project: "acme", tickets: [], machine: "", state: "blocked", reason: "finished", seconds: 0, cost: 0, usage: {}, missing: true }]);
});

test("the first start backfills every record whose run is over, once; the ends heard before it add 0", async () => {
	const box = await load(undefined, true);
	job(box.fake, W1, { usage: JSON.stringify({ "anthropic/m1": usage(10, 2, 0.5) }) });
	job(box.fake, W2, { kind: "review", state: "blocked", reason: "user: which?", since: "2026-11-05T09:00:00.000Z", ran: "12", cost: "0.1000", task: "Review" });
	job(box.fake, W3, { state: "working" });
	job(box.fake, "2026-11-06-worker-0000000e", { state: "idle" });
	job(box.fake, "2026-11-06-worker-0000000d", { state: "blocked", reason: "dependency: x", hold: "x" });
	box.end(W1);
	await box.plugin.start?.();
	const runs = box.runs();
	assert.deepEqual(runs.slice(0, 2).toSorted((a, b) => String(a.job).localeCompare(String(b.job))), [
		{ time: "2026-11-05T09:00:00.000Z", job: W2, kind: "review", project: "acme", tickets: [], machine: "local", state: "blocked", reason: "user: which?", seconds: 12, cost: 0.1, usage: {}, backfill: true },
		{ time: "2026-11-06T10:00:00.000Z", job: W1, kind: "worker", project: "acme", tickets: ["AC0012"], machine: "local", state: "ended", reason: "finished", seconds: 60, cost: 0.5, usage: { "anthropic/m1": usage(10, 2, 0.5) }, backfill: true },
	]);
	assert.deepEqual([runs.length, runs[2]?.job, runs[2]?.cost, runs[2]?.seconds], [3, W1, 0, 0]);
	const again = await load(box.fake);
	await again.plugin.start?.();
	assert.equal(box.runs().length, 3, "no second backfill");
	const empty = await load(undefined, true);
	await empty.plugin.start?.();
	job(empty.fake, W1);
	const restarted = await load(empty.fake);
	await restarted.plugin.start?.();
	assert.deepEqual(restarted.runs(), [], "a first start with no record still backfills once");
});

test("the coordinator's extension the plugin gives: a line per real end of a turn, with its tokens, cost and seconds", async (t: TestContext) => {
	const box = await load();
	const [extension] = box.fake.collect<{ file: string; env: Record<string, string> }>("coordinator.extension");
	assert.deepEqual(extension?.env, { ARTHUR_STATS_FOLDER: box.fake.host.folder });
	const [gates, clock] = [temporaryFolder(), join(temporaryFolder(), "clock")];
	// The owner's messages: one at the start and one after each turn, so each `prompt` starts a turn.
	const owner = join(gates, "owner.mjs");
	writeFileSync(owner, `export default (pi) => { const go = () => pi.sendUserMessage("go"); pi.on("session_start", go); pi.on("agent_end", go); };`);
	writeFileSync(clock, "1000");
	const gate = (name: string) => join(gates, name);
	const steps = [
		{ prompt: true as const }, { waitFor: gate("one") }, { message: "a", cost: 0.25, usage: { input: 10, output: 5 }, model: "m1" }, { end: true as const, continues: true as const }, { end: true as const },
		{ prompt: true as const }, { waitFor: gate("two") }, { message: "b", cost: 0.5, usage: { cacheRead: 7 }, model: "m1" }, { message: "c", usage: { input: 3 }, model: "qwen" }, { end: true as const },
		{ waitFor: gate("release") },
	];
	const agent = fakeAgent({ steps, clock });
	const child = spawn(agent, ["-e", owner, "-e", extension?.file ?? ""], { env: { ...process.env, ...extension?.env }, stdio: "ignore" });
	t.after(() => {
		writeFileSync(gate("release"), "");
		child.kill();
	});
	const [file, turns] = [join(box.fake.host.folder, "sessions", "coordinator.jsonl"), join(dirname(agent), "system.jsonl")];
	// Each turn's start, noted in the same tick as its `agent_start` handlers run, before the clock moves.
	await until("the first turn's start", () => lines(turns).length === 1 || undefined);
	writeFileSync(clock, "3000");
	writeFileSync(gate("one"), "");
	await until("the second turn's start", () => lines(turns).length === 2 || undefined);
	assert.equal(lines(file).length, 1, "the first turn's line, once");
	writeFileSync(clock, "4500");
	writeFileSync(gate("two"), "");
	await until("the second turn's line", () => lines(file).length === 2 || undefined);
	const at = (ms: number) => new Date(ms).toISOString();
	const spent = (input: number, output: number, cacheRead: number, cost: number) => ({ messages: 1, input, output, cacheRead, cacheWrite: 0, cost });
	assert.deepEqual(lines(file), [
		{ time: at(3000), session: "coordinator", seconds: 2, until: 3000, cost: 0.25, usage: { "anthropic/m1": spent(10, 5, 0, 0.25) } },
		{ time: at(4500), session: "coordinator", seconds: 1.5, until: 4500, cost: 0.5, usage: { "anthropic/m1": spent(0, 0, 7, 0.5), "anthropic/qwen": spent(3, 0, 0, 0) } },
	]);
});

test("the extension counts nothing twice across a resume and a restart; a subagent's turn is marked sub and is not the session's own", (t) => {
	t.after(() => delete process.env.ARTHUR_STATS_FOLDER);
	let now = 10_000;
	t.mock.method(Date, "now", () => now);
	type Handler = (event?: object, ctx?: { hasUI: boolean }) => void;
	const agent = () => {
		const handlers = new Map<string, Handler>();
		// omp's handlers as the fake agent calls them: the event, then the context.
		sessionStats({ on: (name: string, handler: Handler) => void handlers.set(name, handler) } as never);
		return { start: () => handlers.get("agent_start")?.(), end: (messages: object[], hasUI = true, willContinue?: true) => handlers.get("agent_end")?.({ messages, willContinue }, { hasUI }), handlers };
	};
	assert.equal(agent().handlers.size, 0, "without ARTHUR_STATS_FOLDER it does nothing");
	process.env.ARTHUR_STATS_FOLDER = temporaryFolder();
	const file = join(process.env.ARTHUR_STATS_FOLDER, "sessions", "coordinator.jsonl");
	const said = (timestamp: number, cost: number) => ({ role: "assistant", provider: "anthropic", model: "m1", timestamp, usage: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 1, cost: { total: cost } } });
	const owner = { role: "user", timestamp: 9_000, content: [{ type: "text", text: "go" }] };
	const m1 = (messages: number, cost: number) => ({ "anthropic/m1": { messages, input: messages, output: 0, cacheRead: 0, cacheWrite: 0, cost } });
	const main = agent();
	main.start();
	now = 12_000;
	main.end([owner, said(11_000, 0.5)], true, true);
	assert.deepEqual(lines(file), [], "a turn that goes on is not over");
	main.start();
	now = 14_000;
	main.end([owner, said(11_000, 0.5), said(13_000, 0.25)]);
	const sub = agent();
	sub.start();
	now = 15_000;
	sub.end([said(14_500, 0.1)], false);
	// omp restarted with `--continue`, after a turn the crash cut short: the conversation holds what was counted.
	const restarted = agent();
	now = 16_000;
	restarted.start();
	now = 17_000;
	const conversation = [owner, said(11_000, 0.5), said(13_000, 0.25), said(14_000, 0.125), said(16_500, 1)];
	restarted.end(conversation);
	now = 18_000;
	restarted.end(conversation);
	const at = (ms: number) => new Date(ms).toISOString();
	assert.deepEqual(lines(file), [
		{ time: at(14_000), session: "coordinator", seconds: 4, until: 13_000, cost: 0.75, usage: m1(2, 0.75) },
		{ time: at(15_000), session: "coordinator", seconds: 1, until: 14_500, sub: true, cost: 0.1, usage: m1(1, 0.1) },
		{ time: at(17_000), session: "coordinator", seconds: 1, until: 16_500, cost: 1.125, usage: m1(2, 1.125) },
		{ time: at(18_000), session: "coordinator", seconds: 0, until: 16_500, cost: 0, usage: {} },
	]);
});

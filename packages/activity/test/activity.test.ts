import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Event } from "@arthur/core/plugin";
import { type FakeHost, fakeHost } from "@arthur/core/testing";
import type { Line } from "../src/activity-line.ts";
import { type ActivityOptions, activity, checkOptions, KEEP_DAYS, TEXT_CHARS, table } from "../src/activity.ts";

// The activity plugin against the fake host: only after `start`, as `arthur run` calls it, are the events written, one file
// per day in `core.timeZone`. The bus's own delivery is the test's: each event as `arthur run` hands it over. docs/activity.md.

const notice = (seq: number, time = "2026-01-01T10:00:00.000Z", by: Event["by"] = { actor: "arthur" }): Event => ({ seq, time, plugin: "core", by, name: "notice", data: { text: `n${seq}` } });

// The plugin set up on `fake`, its subscriptions kept so the test delivers each event; `reads` counts its reads of the log.
function load(fake: FakeHost, options: ActivityOptions = {}) {
	const plugin = activity(options);
	const handlers: [string, (event: Event) => unknown][] = [];
	let reads = 0;
	const read = (from: number) => {
		reads += 1;
		return fake.host.events.read(from);
	};
	void plugin.setup({ ...fake.host, events: { ...fake.host.events, on: (name, fn) => void handlers.push([name, fn]), read } });
	return {
		start: () => plugin.start?.(),
		deliver: (...events: Event[]) => events.forEach((event) => handlers.filter(([name]) => name === event.name).forEach(([, fn]) => fn(event))),
		reads: () => reads,
	};
}
const written = (fake: FakeHost, date: string): Line[] => readFileSync(join(fake.host.folder, "days", `${date}.jsonl`), "utf8").trim().split("\n").map((text) => JSON.parse(text));
const seqs = (fake: FakeHost, date: string) => written(fake, date).map((line) => line.seq);

test("options: keepDays a whole number from 0 to 36500, textChars one from 0; anything else refused naming the option", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ keepDays: 0, textChars: 0 }), [], "0, at the limit");
	assert.deepEqual(checkOptions({ keepDays: 36500, textChars: 1_000_000_000 }), [], "keepDays at its top");
	for (const [value, got] of [[-1, "-1"], [1.5, "1.5"], ["7", '"7"'], [null, "null"]] as const) {
		assert.deepEqual(checkOptions({ keepDays: value }), [{ path: "keepDays", problem: `expected a whole number of days, 0 to 36500, got ${got}` }], got);
		assert.deepEqual(checkOptions({ textChars: value }), [{ path: "textChars", problem: `expected a whole number of characters, 0 or more, got ${got}` }], got);
	}
	for (const [value, got] of [[36501, "36501"], [2e8, "200000000"]] as const)
		assert.deepEqual(checkOptions({ keepDays: value }), [{ path: "keepDays", problem: `expected a whole number of days, 0 to 36500, got ${got}` }], got);
	assert.deepEqual(checkOptions({ days: 7, toString: 1 }), ["days", "toString"].map((path) => ({ path, problem: "unknown option; options: keepDays, textChars" })));
	assert.deepEqual([KEEP_DAYS, TEXT_CHARS, table.keepDays?.default, table.textChars?.default], [90, 300, "90", "300"]);
});

test("a process that never starts writes nothing; arthur run's start writes what came before, then each event as it comes, through the bus", async () => {
	const fake = fakeHost({ name: "activity" });
	await fake.setup(activity());
	fake.emit("notice", { text: "Before." });
	fake.emit("job-steered", { id: "j", kind: "worker", text: "x", via: "steer" });
	assert.equal(existsSync(join(fake.host.folder, "days")), false, "a command process: no file");
	const run = fakeHost({ name: "activity" });
	const plugin = activity();
	await run.setup(plugin);
	const first = run.emit("notice", { text: "Before the start." });
	await plugin.start?.();
	const second = run.emit("ticket-moved", { id: "AC0001", project: "acme", from: "planned", to: "in-progress" });
	run.emit("job-steered", { id: "j", kind: "worker", text: "x", via: "steer" });
	const date = run.host.clock.local(new Date(second.time)).date;
	assert.deepEqual(written(run, date), [
		{ seq: 1, time: first.time, actor: first.by?.actor, plugin: "test", what: "notice", text: "Before the start." },
		{ seq: 2, time: second.time, actor: second.by?.actor, plugin: "test", what: "ticket-moved", project: "acme", ticket: "AC0001", text: "planned -> in-progress" },
	]);
});

test("the day is the event's date in core.timeZone, its midnight there the boundary", () => {
	const fake = fakeHost({ name: "activity", timeZone: "Europe/Warsaw" });
	const box = load(fake);
	box.start();
	box.deliver(notice(1, "2026-01-01T22:59:59.999Z"), notice(2, "2026-01-01T23:00:00.000Z"));
	assert.deepEqual([seqs(fake, "2026-01-01"), seqs(fake, "2026-01-02")], [[1], [2]]);
});

test("the held events are written in number order; a replay after a crash writes nothing twice", () => {
	const fake = fakeHost({ name: "activity" });
	const box = load(fake);
	box.deliver(notice(2), notice(1));
	box.start();
	box.deliver(notice(3), notice(3), notice(2));
	assert.deepEqual(seqs(fake, "2026-01-01"), [1, 2, 3]);
	const next = load(fake);
	next.deliver(notice(3), notice(4));
	next.start();
	next.deliver(notice(4), notice(5));
	assert.deepEqual(seqs(fake, "2026-01-01"), [1, 2, 3, 4, 5]);
	assert.equal(next.reads(), 0, "no gap after the last line: the log is not read");
});

test("a gap after the last line written is filled once from the log, a replay of that line held besides; no line written yet, no read", () => {
	const fake = fakeHost({ name: "activity" });
	const logged = ["one", "two", "three", "four"].map((text) => fake.emit("notice", { text }));
	fake.emit("job-steered", { id: "j", kind: "worker", text: "x", via: "steer" });
	const fifth = fake.emit("notice", { text: "five" });
	const date = fake.host.clock.local(new Date(fifth.time)).date;
	const first = load(fake);
	first.deliver(logged[0] as Event);
	first.start();
	assert.deepEqual([seqs(fake, date), first.reads()], [[1], 0], "nothing written before: no read");
	const second = load(fake);
	second.deliver(logged[0] as Event, fifth);
	second.start();
	assert.deepEqual([seqs(fake, date), second.reads()], [[1, 2, 3, 4, 6], 1]);
	const third = load(fake);
	third.start();
	assert.deepEqual([seqs(fake, date), third.reads()], [[1, 2, 3, 4, 6], 1], "nothing held: the log read once all the same");
});

// The smallest gap, one delivery lost: the event right after the last line, the held one the next after it.
test("a gap of one event, between the last line and the first held event, is read from the log and written", () => {
	const fake = fakeHost({ name: "activity" });
	const [one, two, three] = ["one", "two", "three"].map((text) => fake.emit("notice", { text })) as [Event, Event, Event];
	const date = fake.host.clock.local(new Date(three.time)).date;
	const first = load(fake);
	first.deliver(one);
	first.start();
	const second = load(fake);
	second.deliver(one, three);
	second.start();
	assert.deepEqual([seqs(fake, date), second.reads(), two.seq], [[1, 2, 3], 1, 2]);
});

test("a job's later lines carry the kind and ticket of its job-started", () => {
	const fake = fakeHost({ name: "activity" });
	const box = load(fake);
	box.start();
	const job = "2026-01-01-worker-0000000a";
	box.deliver({ ...notice(1), name: "job-started", data: { id: job, kind: "worker", project: "acme", root: "/r", branch: "b", worktree: "/w", tickets: ["AC0001"], machine: "local" } });
	box.deliver(notice(2, undefined, { actor: `job:${job}` }));
	assert.deepEqual(written(fake, "2026-01-01")[1], { seq: 2, time: "2026-01-01T10:00:00.000Z", actor: `job:${job}`, plugin: "core", what: "notice", ticket: "AC0001", job, kind: "worker", text: "n2" });
});

test("text is cut at 300 characters by default, at textChars when given", () => {
	const fake = fakeHost({ name: "activity" });
	const box = load(fake);
	box.start();
	box.deliver({ ...notice(1), data: { text: "a".repeat(301) } });
	const short = fakeHost({ name: "activity" });
	const other = load(short, { textChars: 1 });
	other.start();
	other.deliver(notice(1));
	assert.deepEqual([written(fake, "2026-01-01")[0], written(short, "2026-01-01")[0]].map((line) => [line?.text.length, line?.cut]), [[300, 301], [1, 2]]);
});

test("day files older than keepDays (90) go at the start and at the first line of a new day, never at a later line of that day", () => {
	const fake = fakeHost({ name: "activity", now: new Date("2026-01-01T12:00:00Z") });
	const days = join(fake.host.folder, "days");
	const make = (...dates: string[]) => {
		mkdirSync(days, { recursive: true });
		for (const date of dates) writeFileSync(join(days, `${date}.jsonl`), "");
	};
	make("2025-10-02", "2025-10-03", "2025-10-04");
	const box = load(fake);
	box.start();
	assert.deepEqual(readdirSync(days).sort(), ["2025-10-03.jsonl", "2025-10-04.jsonl"], "at the start: today 2026-01-01");
	box.deliver(notice(1, "2026-01-01T13:00:00.000Z"), notice(2, "2026-01-02T01:00:00.000Z"));
	assert.deepEqual(readdirSync(days).sort(), ["2025-10-04.jsonl", "2026-01-01.jsonl", "2026-01-02.jsonl"], "the first line of 2026-01-02");
	make("2025-10-01");
	box.deliver(notice(3, "2026-01-02T02:00:00.000Z"));
	assert.ok(readdirSync(days).includes("2025-10-01.jsonl"), "a later line of the same day removes none");
	box.deliver(notice(4, "2026-01-03T02:00:00.000Z"));
	assert.deepEqual(readdirSync(days).sort(), ["2026-01-01.jsonl", "2026-01-02.jsonl", "2026-01-03.jsonl"]);
	const kept = fakeHost({ name: "activity", now: new Date("2026-01-01T12:00:00Z") });
	mkdirSync(join(kept.host.folder, "days"));
	writeFileSync(join(kept.host.folder, "days", "2025-12-01.jsonl"), "");
	load(kept, { keepDays: 30 }).start();
	assert.deepEqual(readdirSync(join(kept.host.folder, "days")), [], "keepDays 30");
	const most = fakeHost({ name: "activity", now: new Date("2026-01-01T12:00:00Z") });
	mkdirSync(join(most.host.folder, "days"));
	for (const date of ["1926-01-01", "2000-01-01"]) writeFileSync(join(most.host.folder, "days", `${date}.jsonl`), "");
	load(most, { keepDays: 36500 }).start();
	assert.deepEqual(readdirSync(join(most.host.folder, "days")), ["2000-01-01.jsonl"], "keepDays at its top, 100 years back");
});

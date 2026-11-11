import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { until } from "@arthur/core/testing";
import { ask, HANDOFF, load, read } from "./restart-setup.ts";

// The coordinator's nightly fresh start (restart-setup.ts): its window, its retries, and the handoff it writes and reads.

test("at freshAt with no job running the coordinator writes its handoff, the conversation starts fresh and reads it first, and Restarted. says (fresh session)", async (t) => {
	const box = await load(t, { freshAt: "23:00" }, "2026-10-18T22:59:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Handoff written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	await sleep(250);
	assert.equal(box.request(), undefined, "nothing before freshAt");
	box.at("2026-10-18T23:00:00+02:00");
	await until("the handoff request", () => first.messages().length === 1);
	assert.deepEqual(first.messages()[0], { content: ask(box.handoff, "in a fresh conversation"), options: { attribution: "agent" }, step: 0 });
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.restarts, [true]);
	assert.deepEqual(box.out, ["session: fresh: done; the coordinator restarts in a fresh conversation, which starts by reading the handoff"]);
	assert.equal(box.request(), undefined);
	assert.deepEqual(box.notices(), [], "no notice before the next coordinator is up");
	const second = box.coordinator({ steps: [{ prompt: true }, { message: "Going on." }, { end: true }, { waitFor: box.gate("never") }] }, []);
	await second.up();
	await until("the handoff read", () => second.messages().length > 0);
	assert.deepEqual(second.messages(), [{ content: read(box.handoff), options: { attribution: "agent" }, step: -1 }], "its first turn reads the handoff");
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), ["Restarted. (fresh session)"]);
	await sleep(250);
	assert.deepEqual([box.restarts, box.notices().length, box.err], [[true], 1, []], "once");
});

test("while a job of any kind runs the fresh start tries again every freshRetryMinutes, never between tries", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 15 }, "2026-10-18T22:59:00+02:00");
	const review = box.job("2026-10-18-review-0000000a", "review");
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await sleep(250);
	review.end();
	box.at("2026-10-18T23:14:00+02:00");
	await sleep(250);
	assert.deepEqual([box.restarts, box.request()], [[], undefined], "the review ran at 23:00; the next try is 23:15");
	box.at("2026-10-18T23:15:00+02:00");
	await until("the restart", () => box.restarts.length === 1);
	// No coordinator runs, so no handoff is asked.
	assert.deepEqual(box.out, ["session: fresh: done; the coordinator restarts in a fresh conversation, with no handoff: no coordinator was running"]);
});

test("while a job runs a try asks the coordinator for nothing", async (t) => {
	const box = await load(t, { freshAt: "23:00" }, "2026-10-18T22:59:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { message: "Asked." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	box.job("2026-10-18-audit-0000000a", "audit");
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await sleep(250);
	assert.deepEqual([first.messages(), box.request(), box.restarts], [[], undefined, []]);
});

test("a job that ends just before freshUntil: the try at freshUntil, off the retry times and after midnight, starts the fresh conversation", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 15, freshUntil: "00:10" }, "2026-10-18T22:59:00+02:00");
	const job = box.job("2026-10-18-worker-0000000a");
	await box.start();
	for (const time of ["2026-10-18T23:00", "2026-10-18T23:15", "2026-10-18T23:45", "2026-10-19T00:00"]) {
		box.at(`${time}:00+02:00`);
		await sleep(250);
	}
	job.end();
	box.at("2026-10-19T00:09:00+02:00");
	await sleep(250);
	assert.deepEqual(box.restarts, []);
	box.at("2026-10-19T00:10:00+02:00");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.restarts, [true]);
});

test("a job running at freshUntil skips that night with one line; no fresh start outside the window; the next night tries again", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 60, freshUntil: "03:00" }, "2026-10-18T22:59:00+02:00");
	const job = box.job("2026-10-18-worker-0000000a");
	box.job("2026-10-18-plan-0000000b", "plan");
	await box.start();
	for (const time of ["2026-10-18T23:00", "2026-10-19T00:00", "2026-10-19T01:00", "2026-10-19T02:00", "2026-10-19T03:00"]) {
		box.at(`${time}:00+02:00`);
		await sleep(250);
	}
	assert.deepEqual(box.out, ["session: fresh: skipped, 2 jobs running at 03:00"]);
	box.job("2026-10-18-plan-0000000b", "plan").end();
	job.end();
	for (const time of ["2026-10-19T03:30", "2026-10-19T12:00", "2026-10-19T22:59"]) {
		box.at(`${time}:00+02:00`);
		await sleep(250);
	}
	assert.deepEqual(box.restarts, [], "outside the window");
	box.at("2026-10-19T23:00:00+02:00");
	await until("the next night's restart", () => box.restarts.length === 1);
});

test("freshUntil equal to freshAt is a single try; earlier than freshAt the window crosses midnight", async (t) => {
	const single = await load(t, { freshAt: "23:00", freshUntil: "23:00" }, "2026-10-18T22:59:00+02:00");
	const job = single.job("2026-10-18-worker-0000000a");
	await single.start();
	single.at("2026-10-18T23:00:00+02:00");
	await until("the skip", () => single.out.length === 1);
	assert.deepEqual(single.out, ["session: fresh: skipped, 1 job running at 23:00"]);
	job.end();
	single.at("2026-10-18T23:15:00+02:00");
	await sleep(250);
	assert.deepEqual(single.restarts, []);
	const across = await load(t, { freshAt: "23:30", freshRetryMinutes: 30, freshUntil: "00:30" }, "2026-10-18T23:00:00+02:00");
	const late = across.job("2026-10-18-worker-0000000c");
	await across.start();
	across.at("2026-10-18T23:30:00+02:00");
	await sleep(250);
	late.end();
	across.at("2026-10-19T00:00:00+02:00");
	await until("the restart after midnight", () => across.restarts.length === 1);
});

test("Arthur down at freshAt skips that night, not run late, and a window passed unseen is not tried late", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshUntil: "03:00" }, "2026-10-18T23:30:00+02:00");
	await box.start();
	box.at("2026-10-18T23:45:00+02:00");
	await sleep(250);
	assert.deepEqual(box.restarts, [], "started inside the window: tonight's freshAt passed");
	// The clock jumps over the next night's window, as after a machine that slept.
	box.at("2026-10-20T04:00:00+02:00");
	await sleep(250);
	assert.deepEqual([box.restarts, box.out], [[], []]);
	box.at("2026-10-20T23:00:00+02:00");
	await until("the restart", () => box.restarts.length === 1);
});

test("a job started during the wait for the handoff: no restart, the wait goes on, and the next try writes the handoff again", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 15 }, "2026-10-18T22:59:00+02:00");
	const run = (gate: string) => [{ prompt: true }, { waitFor: box.gate(gate) }, { message: "Handoff written." }, { end: true }] as const;
	const first = box.coordinator({ steps: [...run("one"), ...run("two"), { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await until("the handoff request", () => first.messages().length === 1);
	const job = box.job("2026-10-18-worker-0000000a");
	writeFileSync(box.handoff, "The first handoff.\n");
	box.open("one");
	await until("the request settled", () => box.request() === undefined);
	await sleep(250);
	assert.deepEqual([box.restarts, box.out], [[], []], "a job runs: no restart, and no line");
	job.end();
	box.at("2026-10-18T23:15:00+02:00");
	await until("the second handoff request", () => first.messages().length === 2);
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("two");
	await until("the restart", () => box.restarts.length === 1);
});

test("a handoff write that fails withdraws that try with one line; the next try writes it again", async (t) => {
	const box = await load(t, { freshAt: "23:00", freshRetryMinutes: 15 }, "2026-10-18T22:59:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { message: "Nothing to write." }, { end: true }, { prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await until("the withdrawn try", () => box.out.length === 1);
	assert.deepEqual(box.out, ["session: fresh: try withdrawn, handoff not written: no new handoff when the coordinator's turn ended; next try at 23:15"]);
	assert.deepEqual(box.restarts, []);
	box.at("2026-10-18T23:15:00+02:00");
	await until("the handoff asked again", () => first.messages().length === 2);
	assert.equal(first.messages()[1]?.content, ask(box.handoff, "in a fresh conversation"));
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("the restart", () => box.restarts.length === 1);
});

test("at a start only a handoff newer than the last one read is read, and an empty one never", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	const quiet = { steps: [{ waitFor: box.gate("never") }] };
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	writeFileSync(join(box.folder, "handoff-read"), String(statSync(box.handoff).mtimeMs));
	const again = box.coordinator(quiet);
	await again.up();
	await sleep(300);
	assert.deepEqual(again.messages(), [], "the last one read is not read again");
	writeFileSync(box.handoff, " \n\n");
	const empty = box.coordinator(quiet);
	await empty.up();
	await sleep(300);
	assert.deepEqual(empty.messages(), [], "an empty one is not read");
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	const newer = box.coordinator(quiet);
	await newer.up();
	// The agent notes its pid before it sends the handoff, and notes the handoff read after.
	await until("the handoff read", () => newer.messages().length > 0);
	assert.deepEqual(newer.messages().map((message) => message.content), [read(box.handoff)]);
	await until("the handoff noted as read", () => readFileSync(join(box.folder, "handoff-read"), "utf8") === String(statSync(box.handoff).mtimeMs));
	const next = box.coordinator(quiet);
	await next.up();
	await sleep(300);
	assert.deepEqual(next.messages(), [], "read once");
});

test("a fresh try whose request cannot be written is told once, and made at the first tick that can write it", async (t) => {
	const box = await load(t, { freshAt: "23:00" }, "2026-10-18T22:59:00+02:00");
	await box.start();
	chmodSync(box.folder, 0o555);
	t.after(() => chmodSync(box.folder, 0o755));
	box.at("2026-10-18T23:00:00+02:00");
	await until("the error", () => box.err.length > 0);
	await sleep(250);
	assert.deepEqual([box.err, box.restarts], [[`session: restart failed: EACCES: permission denied, open '${join(box.folder, `request.json.${process.pid}`)}'`], []]);
	chmodSync(box.folder, 0o755);
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.out, ["session: fresh: done; the coordinator restarts in a fresh conversation, with no handoff: no coordinator was running"]);
});

test("a night's restart that throws is told, and the next night tries again", async (t) => {
	const box = await load(t, { freshAt: "23:00" }, "2026-10-18T22:59:00+02:00");
	// The mark's temporary name taken by a folder: its write throws before the coordinator is restarted.
	const blocked = join(box.folder, `restarted.json.${process.pid}`);
	mkdirSync(blocked);
	await box.start();
	box.at("2026-10-18T23:00:00+02:00");
	await until("the error", () => box.err.length > 0);
	assert.deepEqual([box.err, box.restarts, box.out, box.notices()], [[`session: restart failed: EISDIR: illegal operation on a directory, open '${blocked}'`], [], [], []], "the night's is only logged");
	rmdirSync(blocked);
	box.at("2026-10-19T23:00:00+02:00");
	await until("the next night's restart", () => box.restarts.length === 1);
});

import assert from "node:assert/strict";
import { mkdirSync, rmdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { until } from "@arthur/core/testing";
import { ask, checkout, HANDOFF, load, service } from "./restart-setup.ts";

// A restart due under the service (restart-setup.ts): arthur run itself restarts once Arthur's code changed and no job runs.

test("while a restart is due under the service, /restart ends arthur run after the handoff and the coordinator's restart, and Restarted. after its next start says so", async (t) => {
	const arthur = checkout();
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00", arthur.code);
	service(t, { restart: "always", pid: process.pid });
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	arthur.merge("AR0002");
	const also = "then arthur run ends, a restart being due (AR0002 changed Arthur's code), and its service starts it again on the new code";
	assert.equal(await box.route("/restart"), `restarting: the coordinator writes its handoff first, for at most 120 s; ${also}; Restarted. follows`);
	await until("the handoff request", () => first.messages().length === 1);
	assert.deepEqual([box.restarts, box.ended], [[], []], "nothing before the handoff");
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("arthur run ended", () => box.ended.length === 1);
	assert.deepEqual([box.restarts, box.ended], [[false], [1]], "the coordinator's restart asked first, then arthur run ends");
	assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts, which starts by reading the handoff; arthur run ends, and its service starts it again on the new code"]);
	// The next `arthur run`, as the service starts it: the same plugin started again, then the next coordinator.
	box.stop();
	await box.start();
	await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }).up();
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), ["Restarted. (arthur run restarted)"]);
	assert.equal(await box.route("/restart"), "restarting: the coordinator writes its handoff first, for at most 120 s; Restarted. follows", "the restart is no longer due");
});

test("while a restart is due under the service with no coordinator, or its note is broken, /restart ends arthur run at its next tick", async (t) => {
	for (const [broken, why] of [[false, "AR0002 changed Arthur's code"], [true, "is not what arthur run notes at its start; it is noted again at the next start"]] as const) {
		const arthur = checkout();
		const box = await load(t, {}, "2026-10-18T12:00:00+02:00", arthur.code);
		service(t, { restart: "always", pid: process.pid });
		await box.start();
		const loaded = join(box.folder, "loaded.json");
		if (broken) writeFileSync(loaded, "{ torn");
		else arthur.merge("AR0002");
		const reason = broken ? `${loaded} ${why}` : why;
		assert.equal(await box.route("/restart fresh"), `no coordinator is running, so no handoff is asked; its next start is a fresh conversation; then arthur run ends, a restart being due (${reason}), and its service starts it again on the new code`);
		await until("arthur run ended", () => box.ended.length === 1);
		assert.deepEqual([box.restarts, box.ended, box.request()], [[true], [1], undefined]);
		assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts in a fresh conversation, with no handoff: no coordinator was running; arthur run ends, and its service starts it again on the new code"]);
	}
});

test("an arthur run that is not the service's, or a service without Restart=always, restarts only the coordinator while a restart is due, and says so", async (t) => {
	for (const unit of [{ restart: "always", pid: process.pid + 1 }, { restart: "on-failure", pid: process.pid }]) {
		const arthur = checkout();
		const box = await load(t, {}, "2026-10-18T12:00:00+02:00", arthur.code);
		service(t, unit);
		await box.start();
		arthur.merge("AR0002");
		const only = "a restart is due (AR0002 changed Arthur's code), but arthur run runs without its service, so only the coordinator restarts and the restart stays due";
		assert.equal(await box.route("/restart"), `no coordinator is running, so no handoff is asked; its next start goes on with --continue; ${only}`);
		assert.deepEqual(box.restarts, [false]);
		// A request asking arthur run to end, as one from before its start or by hand: still only the coordinator restarts.
		writeFileSync(join(box.folder, "request.json"), JSON.stringify({ then: "restart", slot: "/restart", asked: Date.now(), waitSeconds: 120, run: true }));
		await until("the second restart", () => box.restarts.length === 2);
		await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }).up();
		await until("the notice", () => box.notices().length === 1);
		assert.deepEqual([box.notices(), box.ended], [["Restarted. (handoff not written)"], []]);
	}
});

test("under the service, /restart with no restart due, or with restartGuard: false, restarts only the coordinator", async (t) => {
	for (const restartGuard of [true, false]) {
		const box = await load(t, { restartGuard }, "2026-10-18T12:00:00+02:00", checkout().code);
		service(t, { restart: "always", pid: process.pid });
		await box.start();
		// Off, the guard notes nothing; a note left from before it was turned off is not read.
		if (!restartGuard) writeFileSync(join(box.folder, "loaded.json"), "{ torn");
		const first = box.coordinator({ steps: [{ prompt: true }, { message: "No handoff." }, { end: true }, { waitFor: box.gate("never") }] });
		await first.up();
		assert.equal(await box.route("/restart"), "restarting: the coordinator writes its handoff first, for at most 120 s; Restarted. follows");
		await until("the restart", () => box.restarts.length === 1);
		await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }).up();
		await until("the notice", () => box.notices().length === 1);
		assert.deepEqual([box.notices(), box.ended], [["Restarted. (handoff not written)"], []]);
	}
});

test("under the service, a restart due is asked by arthur run itself once no job runs: the handoff first, then arthur run ends once, and Restarted. says so", async (t) => {
	const arthur = checkout();
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00", arthur.code);
	service(t, { restart: "always", pid: process.pid });
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	const job = box.job("2026-10-18-worker-0000000a");
	await box.start();
	arthur.merge("AR0002");
	await sleep(250);
	assert.deepEqual([box.request(), first.messages()], [undefined, []], "nothing is asked while a job runs");
	job.end();
	await until("the restart due asked", () => box.request()?.slot === "due");
	const { then, waitSeconds, run } = box.request() ?? {};
	assert.deepEqual({ then, waitSeconds, run }, { then: "restart", waitSeconds: 120, run: true });
	assert.equal(await box.route("/restart"), "error: a restart is already on its way, asked by the restart guard");
	await until("the handoff request", () => first.messages().length === 1);
	assert.equal(first.messages()[0]?.content, ask(box.handoff, "and goes on with this one"));
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("arthur run ended", () => box.ended.length === 1);
	assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts, which starts by reading the handoff; arthur run ends, and its service starts it again on the new code"]);
	// `arthur run` stops after its SIGTERM, not at once: no second restart is asked meanwhile.
	await sleep(250);
	assert.deepEqual([box.restarts, box.ended, box.request(), box.notices()], [[false], [1], undefined, []]);
	box.stop();
	await box.start();
	await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }).up();
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), ["Restarted. (arthur run restarted)"]);
});

test("a restart due is not asked while a request is pending, by an arthur run that is not the service's, or with none due", async (t) => {
	for (const [pending, pid, merged] of [[true, process.pid, true], [false, process.pid + 1, true], [false, process.pid, false]] as const) {
		const arthur = checkout();
		const box = await load(t, {}, "2026-10-18T12:00:00+02:00", arthur.code);
		service(t, { restart: "always", pid });
		await box.start();
		const compaction = { then: "compact", slot: "13:00", asked: Date.now(), waitSeconds: 600 };
		if (pending) writeFileSync(join(box.folder, "request.json"), JSON.stringify(compaction));
		if (merged) arthur.merge("AR0002");
		await sleep(250);
		assert.deepEqual([box.request(), box.restarts, box.ended], [pending ? compaction : undefined, [], []]);
		if (!pending) continue;
		// Once the compaction is over, the restart due is asked.
		writeFileSync(join(box.folder, "request.json"), JSON.stringify({ ...compaction, line: "compacted" }));
		await until("arthur run ended", () => box.ended.length === 1);
		assert.deepEqual(box.restarts, [false]);
	}
});

test("a job started while the restart due waits for the handoff: no notice, and the restart is asked again once it ends", async (t) => {
	const arthur = checkout();
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00", arthur.code);
	service(t, { restart: "always", pid: process.pid });
	const run = (gate: string) => [{ prompt: true }, { waitFor: box.gate(gate) }, { message: "Written." }, { end: true }] as const;
	const first = box.coordinator({ steps: [...run("one"), ...run("two"), { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	arthur.merge("AR0002");
	await until("the handoff request", () => first.messages().length === 1);
	const job = box.job("2026-10-18-worker-0000000b");
	box.open("one");
	await until("the request dropped", () => box.request() === undefined);
	await sleep(250);
	assert.deepEqual([box.request(), box.restarts, box.notices(), first.messages().length], [undefined, [], [], 1]);
	job.end();
	await until("the second handoff request", () => first.messages().length === 2);
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("two");
	await until("arthur run ended", () => box.ended.length === 1);
	assert.deepEqual([box.restarts, box.notices()], [[false], []]);
});

test("a restart due that throws in the tick is logged once, tells the owner nothing, and is made once it can be", async (t) => {
	const arthur = checkout();
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00", arthur.code);
	service(t, { restart: "always", pid: process.pid });
	const blocked = join(box.folder, `restarted.json.${process.pid}`);
	mkdirSync(blocked);
	await box.start();
	arthur.merge("AR0002");
	await until("the error", () => box.err.length > 0);
	await sleep(250);
	assert.deepEqual([box.err, box.restarts, box.notices()], [[`session: restart failed: EISDIR: illegal operation on a directory, open '${blocked}'`], [], []]);
	rmdirSync(blocked);
	await until("arthur run ended", () => box.ended.length === 1);
	assert.deepEqual(box.restarts, [false]);
});

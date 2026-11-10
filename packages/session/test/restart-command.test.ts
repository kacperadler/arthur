import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { temporaryFolder, until } from "@arthur/core/testing";
import { ask, HANDOFF, load, read } from "./restart-setup.ts";

// /restart (restart-setup.ts): its handoff, its refusals, and what it tells the owner.

test("/restart with one job running is refused, naming it; usage; nothing is asked and nothing restarts", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	box.coordinator({ steps: [{ waitFor: box.gate("never") }] });
	box.job("2026-10-18-review-0000000a", "review");
	await box.start();
	assert.equal(await box.route("/restart"), "error: 1 job running: 0000000a; run /stopall first");
	assert.equal(await box.route("/restart fresh"), "error: 1 job running: 0000000a; run /stopall first");
	assert.equal(await box.route("/restart now"), "usage: /restart [fresh]");
	const run = box.fake.commands.find((command) => command.name === "restart")?.run;
	assert.equal(await run?.({ args: ["fresh", "now"], project: undefined }), 2);
	assert.equal(await run?.({ args: ["now"], project: undefined }), 2);
	assert.equal(await run?.({ args: [], project: undefined }), 1);
	assert.deepEqual(box.err, ["usage: arthur restart [fresh]", "usage: arthur restart [fresh]", "error: 1 job running: 0000000a; run /stopall first"]);
	await sleep(1200);
	assert.deepEqual([box.request(), box.restarts], [undefined, []]);
});

test("/restart and /restart fresh with no coordinator running ask for no handoff; Restarted. follows once one is up; an empty after-restart.md is not sent", async (t) => {
	for (const [text, fresh, note] of [["", false, "handoff not written"], [" fresh", true, "fresh session; handoff not written"]] as const) {
		const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
		await box.start();
		const next = fresh ? "is a fresh conversation" : "goes on with --continue";
		assert.equal(await box.route(`/restart${text}`), `no coordinator is running, so no handoff is asked; its next start ${next}`);
		assert.deepEqual([box.restarts, box.request()], [[fresh], undefined]);
		writeFileSync(join(box.folder, "after-restart.md"), "  \n");
		await sleep(1200);
		assert.deepEqual(box.notices(), []);
		await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }).up();
		await until("the notice", () => box.notices().length === 1);
		assert.deepEqual(box.notices(), [`Restarted. (${note})`]);
	}
});

test("/restart with a coordinator: the handoff first, the restart goes on with --continue, the next one reads it, and Restarted. carries the steps and the health lines", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	box.fake.provide("health", () => ["main not pushed for 2 h", " "]);
	box.fake.provide("health", () => "github: CI token missing");
	box.fake.provide("health", () => undefined);
	box.fake.provide("health", () => {
		throw new Error("no repository\nat line 2");
	});
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	assert.equal(await box.route("/restart"), "restarting: the coordinator writes its handoff first, for at most 120 s; Restarted. follows");
	assert.equal(await box.route("/restart fresh"), "error: a restart is already on its way, asked by /restart");
	await until("the handoff request", () => first.messages().length === 1);
	assert.equal(first.messages()[0]?.content, ask(box.handoff, "and goes on with this one"));
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	writeFileSync(join(box.folder, "after-restart.md"), "Log in again: omp login.\n");
	box.open("written");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.restarts, [false]);
	assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts, which starts by reading the handoff"]);
	const second = box.coordinator({ steps: [{ prompt: true }, { message: "Going on." }, { end: true }, { waitFor: box.gate("never") }] });
	await second.up();
	// The agent notes its pid before it sends the handoff, so wait for the message itself.
	await until("the handoff read", () => second.messages().length > 0);
	assert.deepEqual(second.messages().map((message) => message.content), [read(box.handoff)], "the handoff, and never the command's message");
	await until("the notice", () => box.notices().length === 1);
	const health = "Health:\n- main not pushed for 2 h\n- github: CI token missing\n- test: health failed: no repository";
	assert.deepEqual(box.notices(), [`Restarted.\n\nAfter the restart:\nLog in again: omp login.\n\n${health}`]);
	assert.equal(existsSync(join(box.folder, "after-restart.md")), false, "the steps go once");
	assert.ok(!box.fake.emitted.some((event) => event.name !== "phone-command" && JSON.stringify(event.data).includes("/restart")), "the command reaches no inbox, only its own phone-command");
});

test("a handoff not written in time does not stop the restart, and Restarted. says so", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { message: "", stopReason: "error", error: "529 overloaded" }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	assert.equal(await box.route("/restart fresh"), "restarting in a fresh conversation: the coordinator writes its handoff first, for at most 120 s; Restarted. follows");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts in a fresh conversation, with no handoff (handoff not written: no new handoff when the coordinator's turn ended (529 overloaded))"]);
	await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }, []).up();
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), ["Restarted. (fresh session; handoff not written)"]);
	// A request an agent took 120 s ago and did not finish, its agent still there (this test's own process).
	writeFileSync(join(box.folder, "request.json"), JSON.stringify({ then: "restart", slot: "/restart", asked: Date.now() - 120_000, waitSeconds: 120, pid: process.pid }));
	await until("the second restart", () => box.restarts.length === 2);
	assert.equal(box.out[1], "session: restart: done; the coordinator restarts, with no handoff (handoff not written within 120 s)");
});

test("a job started while /restart waits for the handoff stops the restart, with a notice", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	await box.route("/restart");
	await until("the handoff request", () => first.messages().length === 1);
	box.job("2026-10-18-worker-0000000b");
	writeFileSync(box.handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("the notice", () => box.notices().length === 1);
	assert.deepEqual(box.notices(), ["restart: not done, 1 job running: 0000000b; run /stopall first"]);
	assert.deepEqual([box.restarts, box.request(), box.out], [[], undefined, []]);
});

test("a compaction still asked for gives way to /restart", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 600 }, "2026-10-18T12:59:00+02:00");
	const busy = join(temporaryFolder(), "busy.ts");
	writeFileSync(busy, `export default (pi) => pi.on("session_start", () => pi.sendUserMessage("Busy."));\n`);
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("idle") }, { message: "Done." }, { end: true }, { prompt: true }, { message: "No handoff." }, { end: true }, { waitFor: box.gate("never") }] }, ["-e", busy]);
	await first.up();
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the compaction taken", () => box.request()?.then === "compact" && typeof box.request()?.pid === "number");
	assert.equal(await box.route("/restart"), "restarting: the coordinator writes its handoff first, for at most 120 s; Restarted. follows");
	box.open("idle");
	await until("the restart", () => box.restarts.length === 1);
	assert.deepEqual(first.messages().map((message) => message.content), ["Busy.", ask(box.handoff, "and goes on with this one")], "the compaction's handoff is never asked");
	assert.deepEqual(box.out, ["session: restart: done; the coordinator restarts, with no handoff (handoff not written: no new handoff when the coordinator's turn ended)"]);
});

test("a restart's mark that is not one is dropped, named", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	writeFileSync(join(box.folder, "restarted.json"), "{ torn");
	await box.start();
	await until("the mark dropped", () => !existsSync(join(box.folder, "restarted.json")));
	assert.deepEqual(box.err, [`session: ${join(box.folder, "restarted.json")} is not a restart's mark, so it is dropped: { torn`]);
});

test("a /restart that throws in the tick tells the owner on his channel, each time, and is logged once", async (t) => {
	const box = await load(t, {}, "2026-10-18T12:00:00+02:00");
	const blocked = join(box.folder, `restarted.json.${process.pid}`);
	mkdirSync(blocked);
	const first = box.coordinator({ steps: [{ prompt: true }, { message: "", stopReason: "error", error: "529 overloaded" }, { end: true }, { prompt: true }, { message: "", stopReason: "error", error: "529 overloaded" }, { end: true }, { waitFor: box.gate("never") }] });
	await first.up();
	await box.start();
	const failed = `restart: not done: EISDIR: illegal operation on a directory, open '${blocked}'`;
	assert.match(await box.route("/restart"), /Restarted\. follows$/);
	await until("the notice", () => box.notices().length === 1);
	assert.match(await box.route("/restart"), /Restarted\. follows$/);
	await until("the second notice", () => box.notices().length === 2);
	assert.deepEqual([box.notices(), box.restarts, box.err], [[failed, failed], [], [`session: restart failed: EISDIR: illegal operation on a directory, open '${blocked}'`]]);
});

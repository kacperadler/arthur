import assert from "node:assert/strict";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { temporaryFolder, until } from "@arthur/core/testing";
import { ARTHUR, coordinator, HANDOFF, load, TRIGGERS } from "./session-setup.ts";

// A compaction the coordinator runs (session-setup.ts): its handoff written first, read back after, and each way it is withdrawn.

test("at a compactAt slot, or a report at compactAtPercent, the coordinator writes its handoff, the conversation is compacted, and the compacted conversation starts by reading it", async (t) => {
	for (const trigger of TRIGGERS) {
		const box = await load(t, { ...trigger.options, compactWaitSeconds: 60 }, "2026-10-18T12:59:00+02:00");
		const agent = coordinator(t, box.fake, (gate) => ({
			steps: [{ prompt: true }, { waitFor: gate("written") }, { message: "Handoff written." }, { end: true }, { prompt: true }, { message: "Going on." }, { end: true }, { waitFor: gate("release") }],
		}));
		await box.start();
		await sleep(1200);
		assert.equal(box.request(), undefined, "nothing before the slot or the report");
		trigger.fire(box);
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
		const read = `[Arthur] Your conversation was just compacted. Before that you wrote this handoff (${box.handoff}); go on from it:\n\n> Work in progress: AR0143, its worker runs.\n> Next: review its branch.\n> Unanswered: merge AR0140? (asked at 12:40)\n\n${ARTHUR}`;
		assert.deepEqual(agent.messages()[1], { content: read, options: { attribution: "agent" }, step: 4 });
		await until("the request gone", () => box.request() === undefined);
		assert.equal(readFileSync(join(box.fake.host.folder, "handoff-read"), "utf8"), String(statSync(box.handoff).mtimeMs), "noted as read, so no start reads it again");
		assert.deepEqual(box.err, []);
	}
});

test("a handoff write that fails withdraws the compaction with one line and leaves the conversation as it was", async (t) => {
	const endings = [{ message: "Nothing to write." }, { message: "", stopReason: "error" as const, error: "529 overloaded" }];
	for (const [trigger, ending] of TRIGGERS.flatMap((trigger) => endings.map((ending) => [trigger, ending] as const))) {
		const box = await load(t, { ...trigger.options, compactWaitSeconds: 60 }, "2026-10-18T12:59:00+02:00");
		// One the conversation read already, so its start does not read it again.
		writeFileSync(box.handoff, "An older handoff.\n");
		writeFileSync(join(box.fake.host.folder, "handoff-read"), String(statSync(box.handoff).mtimeMs));
		const agent = coordinator(t, box.fake, (gate) => ({ steps: [{ prompt: true }, ending, { end: true }, { waitFor: gate("release") }] }));
		await box.start();
		trigger.fire(box);
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
	for (const trigger of TRIGGERS) {
		const box = await load(t, { ...trigger.options, compactWaitSeconds: 1 }, "2026-10-18T12:59:00+02:00");
		// Another extension starts a turn that runs until the test ends.
		const busy = join(temporaryFolder(), "busy.ts");
		writeFileSync(busy, `export default (pi) => pi.on("session_start", () => pi.sendUserMessage("Busy."));\n`);
		const agent = coordinator(t, box.fake, (gate) => ({ steps: [{ prompt: true }, { waitFor: gate("release") }] }), [busy]);
		await until("the busy turn", () => agent.messages().length === 1);
		await box.start();
		trigger.fire(box);
		await until("the outcome", () => box.out.length === 1);
		assert.deepEqual(box.out, ["session: compact: skipped, session busy for 1 s"]);
		assert.deepEqual(agent.messages().map((message) => message.content), ["Busy."]);
		assert.deepEqual(agent.compactions(), []);
	}
});

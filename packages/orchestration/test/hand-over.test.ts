import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { type AgentStep, fakeHost, until } from "@arthur/core/testing";
import extension, { pause } from "../src/inbox-extension.ts";
import { inbox } from "../src/inbox.ts";
import { AGAIN_MARK, agentClock, ARTHUR, FAILED, gates, goesAgain, handed, load, RESTART, sorted } from "./inbox-setup.ts";
import { NO_UNIX_SOCKET } from "./unix-socket.ts";

// The inbox's hand-over (inbox-setup.ts): a message omp loses, or a turn that ends without a reply, goes again, after a backoff.

test("a hand-over that throws is retried each tick; the third failure in a row is told once, and the next try delivers once", { skip: NO_UNIX_SOCKET }, async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Done." }, { end: true }, { prompt: true }], failSends: 3 });
	await box.start();
	const said = box.say("Go.");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.emitted("notice"), [
		{ text: "the coordinator's inbox could not hand 1 message(s) to the agent 3 times in a row (fake agent: sendUserMessage failed); it keeps trying" },
	]);
	assert.deepEqual(box.messages(), [{ content: "[via telegram]\n> Go.", step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
});

const WATCHDOG = "(no turn started within 30 s); it keeps trying";

test("a hand-over omp takes and then loses goes again, with its mark, after 30 s idle with no turn; after two throws it is the third failure, told", { skip: NO_UNIX_SOCKET }, async (t) => {
	const { file: clock, move } = agentClock();
	const box = await load(t, { steps: [{ prompt: true }, { message: "Redone." }, { end: true }, { prompt: true }], failSends: 2, dropSends: 1, clock });
	mkdirSync(join(box.folder, "inbox", "turn"), { recursive: true });
	writeFileSync(join(box.folder, "inbox", "turn", "108"), JSON.stringify({ channel: "telegram", text: "Not answered." }));
	await box.start();
	// Three ticks ran whole: two hand-overs that throw, then the one omp loses, at the agent's clock as it stands.
	for (const _ of [1, 2]) await box.ticked();
	move(29_999);
	await box.ticked();
	assert.deepEqual(box.messages(), [], "1 ms before 30 s on the agent's clock, however long in real time");
	move(1);
	await until("the delivery", () => box.messages().length === 1);
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [{ content: `[via telegram, ${RESTART}]\n> Not answered.`, step: 0 }]);
	assert.deepEqual(box.emitted("notice"), [{ text: `the coordinator's inbox could not hand 1 message(s) to the agent 3 times in a row ${WATCHDOG}` }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Redone.", answers: [108], channels: ["telegram"] }]);
});

test("a turn whose agent_end says it goes on and then starts none, as after omp's compaction, ends with it after 30 s idle; the next message goes", { skip: NO_UNIX_SOCKET }, async (t) => {
	const steps: AgentStep[] = [{ prompt: true }, { message: "Done." }, { end: true, continues: true }, { prompt: true }, { message: "Again." }, { end: true }, { prompt: true }];
	const { file: clock, move } = agentClock();
	const box = await load(t, { steps, clock });
	await box.start();
	const first = box.say("Go.");
	await until("Go. queued", () => box.resolved(first));
	// A tick saw it queued; it goes once the queue settled a second on the agent's clock, which then stands still.
	await box.ticked();
	move(1000);
	await until("the turn", () => box.messages().length === 1);
	await until("the agent_end that says the turn goes on", () => box.ends().length === 1);
	// After that agent_end, so the turn's `session_stop` never takes it.
	const second = box.say("Next.");
	move(29_999);
	await box.ticked();
	assert.deepEqual(sorted(join(box.folder, "inbox", "answered")), [], "the turn still runs 1 ms before 30 s idle on the agent's clock");
	move(1);
	await until("the first reply", () => box.emitted("coordinator-replied").length === 1);
	await until("the next turn", () => box.messages().length === 2 || (move(500), false));
	await until("the second reply", () => box.emitted("coordinator-replied").length === 2);
	assert.deepEqual(
		box.messages().map((message) => message.content),
		["[via telegram]\n> Go.", "[via telegram]\n> Next."],
	);
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: "Done.", answers: [first], channels: ["telegram"] },
		{ text: "Again.", answers: [second], channels: ["telegram"] },
	]);
	assert.deepEqual(box.emitted("notice"), []);
});

test("omp busy past 30 s before the turn starts, as through its compaction before the prompt, gets the message once", { skip: NO_UNIX_SOCKET }, async (t) => {
	const { file: clock, move } = agentClock();
	const box = await load(t, { steps: [{ prompt: true, compactMs: 32_000 }, { message: "Done." }, { end: true }, { prompt: true }], clock });
	await box.start();
	const said = box.say("Go.");
	await until("Go. queued", () => box.resolved(said));
	await box.ticked();
	move(1000);
	await until("the hand-over", () => box.messages().length === 1);
	// Idle 31 s after the hand-over on the agent's clock, but omp is busy compacting for 32 s of it.
	move(31_000);
	await box.ticked();
	assert.equal(box.messages().length, 1, "no hand-over again while omp is busy");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1 || (move(500), false));
	await box.ticked();
	assert.deepEqual(box.messages(), [{ content: "[via telegram]\n> Go.", step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
	assert.deepEqual(box.emitted("notice"), []);
});

test("a turn that ends in an error answers nothing; its message is delivered again, marked, and answered", { skip: NO_UNIX_SOCKET }, async (t) => {
	const steps: AgentStep[] = [{ prompt: true }, { message: "", stopReason: "error", error: "overloaded" }, { end: true }, { prompt: true }, { message: "Done." }, { end: true }, { prompt: true }];
	const box = await load(t, { steps });
	await box.start();
	const said = box.say("Go.");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [
		{ content: "[via telegram]\n> Go.", step: 0 },
		{ content: "[via telegram, sent before; its turn ended without a reply]\n> Go.", step: 3 },
	]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
});

test("a turn that keeps ending without a reply has its messages go again at once, then after 5 s, then 10 s; only the third such turn is told", { skip: NO_UNIX_SOCKET }, async (t) => {
	const { file: clock, move } = agentClock();
	const box = await load(t, { steps: [...FAILED, ...FAILED, ...FAILED, ...FAILED, { prompt: true }], clock });
	await box.start();
	await handed(box, move, "Go.");
	await goesAgain(box, move, 0);
	await until("the second turn's end", () => box.ends().length === 2);
	await until("the outbox swept", () => sorted(join(box.folder, "outbox")).every((name) => !name.endsWith(".json")));
	assert.deepEqual(box.emitted("notice"), [], "two turns without a reply tell nothing");
	await goesAgain(box, move, 5000);
	await goesAgain(box, move, 10_000);
	// Past the fourth turn's end, which tells nothing more.
	await until("the fourth turn's end", () => box.ends().length === 4);
	await until("the outbox swept", () => sorted(join(box.folder, "outbox")).every((name) => !name.endsWith(".json")));
	assert.deepEqual(box.emitted("notice"), [
		{ text: "the coordinator's last 3 turns ended without a reply (error: overloaded); their messages go again in 10 s, then after twice as long each time, at most 5 min" },
	]);
	assert.deepEqual(
		box.messages().map((message) => message.content),
		["[via telegram]\n> Go.", `${AGAIN_MARK}\n> Go.`, `${AGAIN_MARK}\n> Go.`, `${AGAIN_MARK}\n> Go.`],
	);
	assert.deepEqual(box.emitted("coordinator-replied"), []);
});

test("the notice after 3 turns without a reply never repeats a credential in omp's error, nor any part of an env file value", { skip: NO_UNIX_SOCKET }, async (t) => {
	t.after(() => delete process.env.ARTHUR_INBOX_TEST_API_KEY);
	process.env.ARTHUR_INBOX_TEST_API_KEY = "hunter-two-secret";
	// An env file value whose tail has a vendor key's shape: redacted in two passes, its head would be sent.
	const error = "401 invalid x-api-key sk-ant-api03-AbCdEf123456 (hunter-two-secret), password pass-word-sk-live-4f9a8b7c, request_id req_011CgAWsav66AwnrHwNLjFA6";
	const box = await load(t, { steps: [...FAILED, ...FAILED, { prompt: true }, { message: "", stopReason: "error", error }, { end: true }, { prompt: true }] }, { env: { ARTHUR_ORCHESTRATION_PASS: "pass-word-sk-live-4f9a8b7c" } });
	await box.start();
	box.say("Go.");
	await until("the notice", () => box.emitted("notice").length === 1);
	assert.deepEqual(box.emitted("notice"), [
		{ text: "the coordinator's last 3 turns ended without a reply (error: 401 invalid x-api-key [redacted] ([redacted]), password [redacted], request_id [redacted]); their messages go again in 10 s, then after twice as long each time, at most 5 min" },
	]);
});

test("the extension's notice of omp's error reaches the phone with each env file value redacted whole, which the coordinator's environment never holds", (t) => {
	const fake = fakeHost({ name: "orchestration", env: { ARTHUR_ORCHESTRATION_PASS: "pass-word-sk-live-4f9a8b7c" } });
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	process.env.ARTHUR_ORCHESTRATION_FOLDER = fake.host.folder;
	const handlers = new Map<string, (event: object, ctx: object) => void>();
	extension({ on: (name: string, handler: (event: object, ctx: object) => void) => void handlers.set(name, handler), sendUserMessage: () => {} } as unknown as Parameters<typeof extension>[0]);
	const error = { role: "assistant", content: [], stopReason: "error", errorMessage: "401 password pass-word-sk-live-4f9a8b7c" };
	mkdirSync(join(fake.host.folder, "inbox", "queued"), { recursive: true });
	// Three turns in a row, each an owner's message handed after a tool call, end in omp's error.
	for (const seq of [1, 2, 3]) {
		writeFileSync(join(fake.host.folder, "inbox", "queued", `${seq}-1792363617800`), JSON.stringify({ channel: "telegram", text: "Go." }));
		handlers.get("tool_result")?.({}, { hasUI: true });
		handlers.get("agent_end")?.({ messages: [error] }, { hasUI: true });
	}
	const run = inbox(fake.host);
	t.after(() => run.stop());
	run.start();
	run.stop();
	assert.deepEqual(fake.emitted.filter((event) => event.name === "notice").map((event) => event.data), [
		{ text: "the coordinator's last 3 turns ended without a reply (error: 401 password [redacted]); their messages go again in 10 s, then after twice as long each time, at most 5 min" },
	]);
});

test("a reply ends the wait: the next turn that ends without a reply has its messages go again at once", { skip: NO_UNIX_SOCKET }, async (t) => {
	const steps: AgentStep[] = [...FAILED, ...FAILED, { prompt: true }, { message: "Done." }, { end: true }, ...FAILED, { prompt: true }, { message: "Again." }, { end: true }, { prompt: true }];
	const { file: clock, move } = agentClock();
	const box = await load(t, { steps, clock });
	await box.start();
	const first = await handed(box, move, "Go.");
	await goesAgain(box, move, 0);
	await goesAgain(box, move, 5000);
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	const second = await handed(box, move, "Again?");
	// Two turns without a reply before the reply: without it, this third would wait 10 s.
	await goesAgain(box, move, 0);
	await until("the second reply", () => box.emitted("coordinator-replied").length === 2);
	assert.deepEqual(
		box.messages().map((message) => message.content),
		["[via telegram]\n> Go.", `${AGAIN_MARK}\n> Go.`, `${AGAIN_MARK}\n> Go.`, "[via telegram]\n> Again?", `${AGAIN_MARK}\n> Again?`],
	);
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: "Done.", answers: [first], channels: ["telegram"] },
		{ text: "Again.", answers: [second], channels: ["telegram"] },
	]);
	assert.deepEqual(box.emitted("notice"), []);
});

test("a new owner message ends the wait: the waiting messages and the new one go at the next tick; a message from Arthur waits with them", { skip: NO_UNIX_SOCKET }, async (t) => {
	const { file: clock, move } = agentClock();
	const box = await load(t, { steps: [...FAILED, ...FAILED, ...FAILED, { prompt: true }, { message: "Done." }, { end: true }, { prompt: true }], clock });
	await box.start();
	const first = await handed(box, move, "Go.");
	await goesAgain(box, move, 0);
	await goesAgain(box, move, 5000);
	// Three failed turns: the wait is 10 s.
	await until("the third turn's end", () => box.ends().length === 3);
	const scheduled = box.fake.emit("coordinator-message", { text: "Write the morning report." }).seq;
	await until("the message from Arthur queued", () => existsSync(join(box.folder, "inbox", "queued", box.file(scheduled))));
	move(9999);
	await box.ticked();
	assert.equal(box.messages().length, 3, "a message from Arthur does not end the wait");
	const second = box.say("Now?");
	await until("Now? queued", () => box.resolved(second));
	await box.ticked();
	assert.equal(box.messages().length, 4, "the owner's message goes at the next tick, 1 ms before the wait's end on the agent's clock");
	assert.equal(box.messages()[3]?.content, [`${AGAIN_MARK}\n> Go.`, "[Arthur: test]\n> Write the morning report.", "[via telegram]\n> Now?", ARTHUR].join("\n\n"));
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [first, scheduled, second], channels: ["telegram"] }]);
});

test("the wait before a failed turn's messages go again is none the first time, then 5 s doubling, at most 5 min", () => {
	assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 50].map(pause), [0, 5000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000, 300_000]);
});

test("a coordinator restarted mid-turn gets the message once more, marked, answers it once, and never a third time", { skip: NO_UNIX_SOCKET }, async (t) => {
	const gate = gates();
	const box = await load(t, { steps: [{ prompt: true }, { waitFor: gate.at("one") }, { message: "Done." }, { end: true }, { prompt: true }] });
	await box.start();
	const said = box.say("Start AR0081.");
	await until("the turn", () => box.messages().length === 1);
	spawnSync("tmux", ["-S", box.socket, "kill-session", "-t", "=coord"]);
	gate.open("one");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	await sleep(1500);
	assert.deepEqual(box.messages(), [
		{ content: "[via telegram]\n> Start AR0081.", step: 0 },
		{ content: `[via telegram, ${RESTART}]\n> Start AR0081.`, step: 0 },
	]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
	assert.equal(box.starts().length, 2);
});

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, utimesSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { NOT_TRANSCRIBED } from "@arthur/core/parts";
import { type AgentRun, type AgentStep, type FakeHost, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { pause } from "../src/inbox-extension.ts";
import { inbox, queue } from "../src/inbox.ts";
import { orchestration } from "../src/orchestration.ts";

const PATH = process.env.PATH ?? "";
const AGAIN = "Your reply above has not been sent; write one reply that answers this together with everything your reply above answered.";
const ARTHUR = "The lines marked [Arthur] come from Arthur (a job's end, a schedule), not from the owner.";
const RESTART = "sent before a restart; no reply to it was sent";
const DAY = 24 * 3_600_000;

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// Files a fake's `waitFor` steps wait for.
function gates() {
	const folder = temporaryFolder();
	return { at: (name: string) => join(folder, name), open: (name: string) => writeFileSync(join(folder, name), "") };
}

// Whole lines only: a line the agent is still appending has no line break yet.
const lines = (file: string): Record<string, unknown>[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line)) : []);
const sorted = (folder: string) => (existsSync(folder) ? readdirSync(folder).sort() : []);

// The plugin on a fake host with `projects` provided, if given, and its coordinator the fake agent playing `run` in a tmux
// server on a socket in the test's folder, killed when the test ends; `start` puts that agent on `PATH` and starts the plugin.
async function load(t: TestContext, run: AgentRun, setup: { readonly root?: string; readonly projects?: readonly unknown[] } = {}) {
	const agent = fakeAgent(run);
	const socket = join(temporaryFolder(), "tmux.sock");
	const options = { coordinator: { exitWaitSeconds: 1, restartDelaySeconds: 1, tmux: { session: "coord", socket } } };
	const errors: string[] = [];
	t.mock.method(console, "log", () => {});
	t.mock.method(console, "error", (text: string) => void errors.push(text));
	const fake = fakeHost({ name: "orchestration", root: setup.root });
	if (setup.projects !== undefined) fake.provide("projects", () => setup.projects);
	const plugin = orchestration(options);
	await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	t.after(async () => {
		await plugin.stop?.();
		spawnSync("tmux", ["-S", socket, "kill-server"]);
		process.env.PATH = PATH;
	});
	const folder = fake.host.folder;
	return {
		fake,
		folder,
		errors,
		socket,
		start() {
			process.env.PATH = `${dirname(agent)}${delimiter}${PATH}`;
			return plugin.start?.();
		},
		messages: () => lines(join(dirname(agent), "messages.jsonl")),
		ui: () => lines(join(dirname(agent), "ui.jsonl")),
		starts: () => lines(join(dirname(agent), "starts.jsonl")),
		emitted: (name: string) => fake.emitted.filter((event) => event.name === name).map((event) => event.data),
		say: (text: string, channel = "telegram") => fake.emit("message-received", { channel, parts: [{ kind: "text", text, mime: "text/plain" }] }).seq,
		// The inbox file of event `seq`: `<number>-<time in ms>`.
		file: (seq: number) => { const event = fake.host.events.read(seq).find((each) => each.seq === seq); return `${seq}-${Date.parse(event?.time ?? "")}`; },
		// Whether the owner's message `seq` left `inbox/received/`, its parts resolved and the message queued.
		resolved(seq: number) {
			return !existsSync(join(folder, "inbox", "received", this.file(seq)));
		},
	};
}

// A repository with one commit, for a real job.
function repository(): string {
	const root = temporaryFolder();
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: root });
	git("init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "# demo\n");
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	return root;
}

// The data of the job-ended a job's wrapper emitted; it writes the job's state and result before that, so a job seen ended
// may not have emitted it yet.
async function jobEnded(fake: FakeHost): Promise<unknown> {
	let data: unknown;
	await until("the job's job-ended", () => (data = fake.host.events.read(1).find((event) => event.name === "job-ended")?.data) !== undefined);
	return data;
}

test("a message while idle is one turn marked with its channel, its reply emitted with its number; one after that turn ended is the next turn", async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Started." }, { end: true }, { prompt: true }, { message: "Also started." }, { end: true }, { prompt: true }] });
	await box.start();
	const first = box.say("Start AR0081.");
	await until("the first reply", () => box.emitted("coordinator-replied").length === 1);
	const second = box.say("And AR0085.");
	await until("the second reply", () => box.emitted("coordinator-replied").length === 2);
	assert.deepEqual(box.messages(), [
		{ content: "[via telegram] Start AR0081.", step: 0 },
		{ content: "[via telegram] And AR0085.", step: 3 },
	]);
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: "Started.", answers: [first], channels: ["telegram"] },
		{ text: "Also started.", answers: [second], channels: ["telegram"] },
	]);
	assert.deepEqual(sorted(join(box.folder, "inbox", "answered")), [box.file(first), box.file(second)].sort());
	assert.deepEqual([...sorted(join(box.folder, "inbox", "queued")), ...sorted(join(box.folder, "inbox", "turn")), ...sorted(join(box.folder, "outbox")).filter((name) => name !== "sent")], []);
	assert.equal(sorted(join(box.folder, "outbox", "sent")).length, 2);
});

test("a message mid-turn joins it after the next tool call as an aside, never a steer, and the one reply answers both", async (t) => {
	const gate = gates();
	const steps: AgentStep[] = [{ prompt: true }, { waitFor: gate.at("one") }, { tool: "bash", output: "no jobs" }, { tool: "bash", output: "ok" }, { message: "Stopped AR0081; AR0085 runs." }, { end: true }, { prompt: true }];
	const box = await load(t, { steps });
	await box.start();
	const first = box.say("Start AR0081.");
	await until("the turn", () => box.messages().length === 1);
	const second = box.say("Stop AR0081, start AR0085 instead.");
	await sleep(1200);
	assert.equal(box.messages().length, 1, "nothing before the next tool call");
	gate.open("one");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages()[1], { content: "[via telegram, sent during this turn] Stop AR0081, start AR0085 instead.", options: { deliverAs: "aside" }, step: 2 });
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Stopped AR0081; AR0085 runs.", answers: [first, second], channels: ["telegram"] }]);
});

test("two messages in one tool call reach the turn in one aside, in order, and the reply goes to both channels", async (t) => {
	const gate = gates();
	const box = await load(t, { steps: [{ prompt: true }, { waitFor: gate.at("one") }, { tool: "bash" }, { message: "Both." }, { end: true }, { prompt: true }] });
	await box.start();
	const first = box.say("One.");
	await until("the turn", () => box.messages().length === 1);
	const [second, third] = [box.say("Two."), box.say("Three.", "slack")];
	gate.open("one");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages().slice(1), [{ content: "[via telegram, sent during this turn] Two.\n\n[via slack, sent during this turn] Three.", options: { deliverAs: "aside" }, step: 2 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Both.", answers: [first, second, third], channels: ["telegram", "slack"] }]);
});

test("a message after the last tool call, the reply already written, resumes the turn; only the second reply is emitted, answering both", async (t) => {
	const gate = gates();
	const steps: AgentStep[] = [{ prompt: true }, { message: "First reply." }, { waitFor: gate.at("one") }, { end: true }, { message: "Second reply." }, { end: true }, { prompt: true }];
	const box = await load(t, { steps });
	await box.start();
	const first = box.say("Status?");
	await until("the turn", () => box.messages().length === 1);
	const second = box.say("And the budget?");
	gate.open("one");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages()[1], { content: `[via telegram, sent during this turn, after your last tool call] And the budget?\n\n${AGAIN}`, options: { continue: true }, step: 3 });
	await sleep(1200);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Second reply.", answers: [first, second], channels: ["telegram"] }]);
});

test("past omp's 8 continuations in a turn, a message is not answered by that turn's reply but is the next turn", async (t) => {
	const gate = gates();
	const steps: AgentStep[] = [{ prompt: true }, { message: "r0" }];
	for (let index = 1; index <= 9; index++) steps.push({ waitFor: gate.at(String(index)) }, { end: true }, { message: `r${index}` });
	steps.push({ prompt: true }, { message: "next" }, { end: true }, { prompt: true });
	const box = await load(t, { steps });
	await box.start();
	const numbers = [box.say("m0")];
	await until("the turn", () => box.messages().length === 1);
	for (let index = 1; index <= 9; index++) {
		numbers.push(box.say(`m${index}`));
		await until(`m${index} queued`, () => box.resolved(numbers[index] ?? 0));
		gate.open(String(index));
		if (index < 9) await until(`continuation ${index}`, () => box.messages().length === 1 + index);
	}
	await until("two replies", () => box.emitted("coordinator-replied").length === 2);
	// The ninth was refused, so its turn ended with r8, the reply before the refused end.
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: "r8", answers: numbers.slice(0, 9), channels: ["telegram"] },
		{ text: "next", answers: [numbers[9]], channels: ["telegram"] },
	]);
	assert.deepEqual(box.messages().at(-1), { content: "[via telegram] m9", step: 29 });
});

test("several messages while idle, each within a second of the last, are one turn, in order", async (t) => {
	// The agent's clock stands still where the test puts it, so a stalled runner never splits the burst.
	const clock = join(temporaryFolder(), "clock");
	let now = Date.now();
	const move = (ms: number) => {
		writeFileSync(`${clock}.new`, String((now += ms)));
		renameSync(`${clock}.new`, clock);
	};
	move(0);
	const box = await load(t, { steps: [{ prompt: true }, { message: "All three." }, { end: true }, { prompt: true }], clock });
	await box.start();
	// The footer is the sign the extension ticks.
	writeFileSync(join(box.folder, "footer"), "arthur · ready");
	await until("the extension's first tick", () => box.ui().length > 0);
	const numbers: number[] = [];
	for (const text of ["One.", "Two.", "Three.", "Four."]) {
		numbers.push(box.say(text));
		move(900);
	}
	// Four more ticks, over a second of real time: the agent's clock still says 0 ms since the last message.
	for (const tick of [1, 2, 3, 4]) {
		writeFileSync(join(box.folder, "footer"), `arthur · tick ${tick}`);
		await until(`tick ${tick}`, () => box.ui().length === 1 + tick);
	}
	assert.deepEqual(box.messages(), [], "under a second since the last message, however long in real time");
	await until("the turn", () => box.messages().length > 0 || (move(500), false));
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [{ content: "[via telegram] One.\n\n[via telegram] Two.\n\n[via telegram] Three.\n\n[via telegram] Four.", step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "All three.", answers: numbers, channels: ["telegram"] }]);
});

test("job ends and a schedule message mid-turn wait for the next turn: one message from Arthur with one instruction line", async (t) => {
	const root = repository();
	const projects = [{ name: "acme", path: root, prefix: "AC" }, { name: "shop", path: join(root, "..", "shop"), prefix: "SH" }];
	const gate = gates();
	const steps: AgentStep[] = [{ prompt: true }, { waitFor: gate.at("one") }, { tool: "bash" }, { message: "Answered." }, { end: true }, { prompt: true }, { message: "Read the ends." }, { end: true }, { prompt: true }];
	const box = await load(t, { steps }, { root, projects });
	// Asked with the job-ended data and the final message whole, not only the lines the wake shows.
	box.fake.provide("coordinator.wake", (job: { kind: string }, final: string) => (job.kind === "worker" ? `Procedure: review its branch against the ticket; its final message ends ${JSON.stringify(final.slice(-7))}.` : undefined));
	const result = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: result }] }))}${delimiter}${PATH}`;
	const job = await box.fake.host.jobs.spawn({ task: "Go." });
	const ended = (await jobEnded(box.fake)) as Record<string, unknown>;
	await box.start();
	const first = box.say("What runs?");
	await until("the turn", () => box.messages().length === 1);
	const wakes = [box.fake.emit("job-ended", ended).seq, box.fake.emit("job-ended", { id: "2026-10-17-worker-0000abcd", kind: "worker", project: "shop", state: "blocked", reason: "user: may I?" }).seq];
	const scheduled = box.fake.emit("coordinator-message", { text: "[scheduled morning] Write the morning report." }).seq;
	const second = box.say("Also merge AR0081.");
	gate.open("one");
	await until("two replies", () => box.emitted("coordinator-replied").length === 2);
	assert.deepEqual(box.messages()[1], { content: "[via telegram, sent during this turn] Also merge AR0081.", options: { deliverAs: "aside" }, step: 2 });
	const wake = [
		`[Arthur] Job ${job.id} ended its run: ended (finished).`,
		"Its final message (the first 15 of 20 lines):",
		...result.split("\n").slice(0, 15),
		'Procedure: review its branch against the ticket; its final message ends "line 20".',
		"",
		"[Arthur] Job 2026-10-17-worker-0000abcd ended its run blocked on the owner; its question, also sent as a notice: may I?",
		"Project: shop.",
		"Its final message: none.",
		'Procedure: review its branch against the ticket; its final message ends "".',
		"",
		"[Arthur] [scheduled morning] Write the morning report.",
		"",
		ARTHUR,
	].join("\n");
	assert.deepEqual(box.messages()[2], { content: wake, options: { attribution: "agent" }, step: 5 });
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: "Answered.", answers: [first, second], channels: ["telegram"] },
		{ text: "Read the ends.", answers: [...wakes, scheduled], channels: [] },
	]);
});

test("coordinator.turn answers the very text the idle inbox hands over for an event alone; another event, a malformed one, a part to claim are refused", async (t) => {
	const root = repository();
	const projects = [{ name: "acme", path: root, prefix: "AC" }, { name: "shop", path: join(root, "..", "shop"), prefix: "SH" }];
	const steps: AgentStep[] = ["One.", "Two.", "Three."].flatMap((reply): AgentStep[] => [{ prompt: true }, { message: reply }, { end: true }]);
	const box = await load(t, { steps: [...steps, { prompt: true }] }, { root, projects });
	box.fake.provide("coordinator.wake", (job: { kind: string }, final: string) => (job.kind === "worker" ? "Procedure: review its branch against the ticket." : `It ends ${JSON.stringify(final.slice(-5))}.`));
	const turn = (...asked: unknown[]) => box.fake.call<Promise<string>>("coordinator.turn", ...asked);
	await box.start();
	const text = (said: string) => ({ kind: "text", text: said, mime: "text/plain" });
	const events = [
		["message-received", { channel: "signal", parts: [text("Merge AR0081."), text("Then AR0085.")] }],
		["coordinator-message", { text: "[scheduled morning] Write the morning report." }],
		["job-ended", { id: "2026-10-17-worker-0000abcd", kind: "worker", project: "shop", state: "blocked", reason: "user: may I?" }],
	] as const;
	for (const [index, [name, data]] of events.entries()) {
		box.fake.emit(name, data);
		await until(`reply ${index + 1}`, () => box.emitted("coordinator-replied").length === index + 1);
		assert.equal(await turn(name, data), box.messages()[index]?.content, name);
	}
	assert.equal(box.messages()[2]?.content, `[Arthur] Job 2026-10-17-worker-0000abcd ended its run blocked on the owner; its question, also sent as a notice: may I?\nProject: shop.\nIts final message: none.\nProcedure: review its branch against the ticket.\n\n${ARTHUR}`);
	const job = { id: "2026-10-17-review-0000abce", kind: "review", project: "acme", state: "ended", reason: "finished" };
	assert.equal(await turn("job-ended", job, "Done.\nPASS\n"), `[Arthur] Job ${job.id} ended its run: ended (finished).\nIts final message:\nDone.\nPASS\nIt ends "PASS\\n".\n\n${ARTHUR}`, "result stands for the job's final message, for the plugins too");
	const refused = (message: string) => ({ message: `coordinator.turn: ${message}` });
	await assert.rejects(turn("job-started", {}), refused('expected message-received, coordinator-message or job-ended, got "job-started"'));
	await assert.rejects(turn("coordinator-message", { text: " " }), refused("coordinator-message: expected { text }, non-empty text"));
	await assert.rejects(turn("message-received", { parts: [text("Hi.")] }), refused("message-received: expected channel, non-empty text, got nothing"));
	const voice = { kind: "voice", path: "/home/arthur/.arthur/telegram/media/AwAD.oga", mime: "audio/ogg", seconds: 4 };
	await assert.rejects(turn("message-received", { channel: "telegram", parts: [text("Hear this."), voice] }), refused("message-received: text parts only; a voice part is resolved by the plugins that claim it"));
	assert.equal(box.emitted("coordinator-replied").length, 3, "asking replies to no one, a voice note's line included");
	assert.deepEqual([sorted(join(box.folder, "inbox", "queued")), sorted(join(box.folder, "inbox", "turn"))], [[], []], "asking queues nothing");
});

test("a hand-over that throws is retried each tick; the third failure in a row is told once, and the next try delivers once", async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Done." }, { end: true }, { prompt: true }], failSends: 3 });
	await box.start();
	const said = box.say("Go.");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.emitted("notice"), [
		{ text: "the coordinator's inbox could not hand 1 message(s) to the agent 3 times in a row (fake agent: sendUserMessage failed); it keeps trying" },
	]);
	assert.deepEqual(box.messages(), [{ content: "[via telegram] Go.", step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
});

const WATCHDOG = "(no turn started within 30 s); it keeps trying";

test("a hand-over omp takes and then loses goes again, with its mark, after 30 s idle with no turn; after two throws it is the third failure, told", async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Redone." }, { end: true }, { prompt: true }], failSends: 2, dropSends: 1 });
	mkdirSync(join(box.folder, "inbox", "turn"), { recursive: true });
	writeFileSync(join(box.folder, "inbox", "turn", "108"), JSON.stringify({ channel: "telegram", text: "Not answered." }));
	const startedAt = Date.now();
	await box.start();
	await until("the delivery", () => box.messages().length === 1, 45_000);
	assert.ok(Date.now() - startedAt >= 30_000, `the lost hand-over goes again only after 30 s: ${Date.now() - startedAt}`);
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [{ content: `[via telegram, ${RESTART}] Not answered.`, step: 0 }]);
	assert.deepEqual(box.emitted("notice"), [{ text: `the coordinator's inbox could not hand 1 message(s) to the agent 3 times in a row ${WATCHDOG}` }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Redone.", answers: [108], channels: ["telegram"] }]);
});

test("a turn whose agent_end says it goes on and then starts none, as after omp's compaction, ends with it after 30 s idle; the next message goes", async (t) => {
	const steps: AgentStep[] = [{ prompt: true }, { message: "Done." }, { end: true, continues: true }, { prompt: true }, { message: "Again." }, { end: true }, { prompt: true }];
	const box = await load(t, { steps });
	await box.start();
	// Taken before the message: the turn's 30 s idle starts after it, however late the test sees the turn.
	const saidAt = Date.now();
	const first = box.say("Go.");
	await until("the turn", () => box.messages().length === 1);
	await sleep(1000);
	const second = box.say("Next.");
	await until("the first reply", () => box.emitted("coordinator-replied").length === 1, 45_000);
	assert.ok(Date.now() - saidAt >= 30_000, `the turn ends only after 30 s idle: ${Date.now() - saidAt}`);
	await until("the second reply", () => box.emitted("coordinator-replied").length === 2);
	assert.deepEqual(
		box.messages().map((message) => message.content),
		["[via telegram] Go.", "[via telegram] Next."],
	);
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: "Done.", answers: [first], channels: ["telegram"] },
		{ text: "Again.", answers: [second], channels: ["telegram"] },
	]);
	assert.deepEqual(box.emitted("notice"), []);
});

test("omp busy past 30 s before the turn starts, as through its compaction before the prompt, gets the message once", async (t) => {
	const box = await load(t, { steps: [{ prompt: true, compactMs: 32_000 }, { message: "Done." }, { end: true }, { prompt: true }] });
	await box.start();
	const said = box.say("Go.");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1, 45_000);
	await sleep(1500);
	assert.deepEqual(box.messages(), [{ content: "[via telegram] Go.", step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
	assert.deepEqual(box.emitted("notice"), []);
});

test("a turn that ends in an error answers nothing; its message is delivered again, marked, and answered", async (t) => {
	const steps: AgentStep[] = [{ prompt: true }, { message: "", stopReason: "error", error: "overloaded" }, { end: true }, { prompt: true }, { message: "Done." }, { end: true }, { prompt: true }];
	const box = await load(t, { steps });
	await box.start();
	const said = box.say("Go.");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [
		{ content: "[via telegram] Go.", step: 0 },
		{ content: "[via telegram, sent before; its turn ended without a reply] Go.", step: 3 },
	]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
});

// The times at which the fake agent got its first `count` messages, polled as `until` does.
async function deliveries(box: { messages(): unknown[] }, count: number): Promise<number[]> {
	const at: number[] = [];
	while (at.length < count) {
		await until(`delivery ${at.length + 1}`, () => box.messages().length > at.length);
		at.push(Date.now());
	}
	return at.slice(1).map((time, index) => time - (at[index] ?? 0));
}
const FAILED: AgentStep[] = [{ prompt: true }, { message: "", stopReason: "error", error: "overloaded" }, { end: true }];
const AGAIN_MARK = "[via telegram, sent before; its turn ended without a reply]";

test("a turn that keeps ending without a reply has its messages go again at once, then after 5 s, then 10 s; only the third such turn is told", async (t) => {
	const box = await load(t, { steps: [...FAILED, ...FAILED, ...FAILED, ...FAILED, { prompt: true }] });
	await box.start();
	box.say("Go.");
	const [quick = 0, five = 0, ten = 0] = await deliveries(box, 4);
	// Each wait apart from the one before and after it (0, 5, 10, 20 s), with room for a slow runner's lag either way.
	assert.ok(quick < 4000, `the first redelivery is quick: ${quick}`);
	assert.ok(five >= 4000 && five < 9000, `the second waits 5 s: ${five}`);
	assert.ok(ten >= 9000 && ten < 19_000, `the third waits 10 s: ${ten}`);
	// Past the fourth turn's end, which tells nothing more.
	await sleep(1500);
	assert.deepEqual(box.emitted("notice"), [
		{ text: "the coordinator's last 3 turns ended without a reply (error: overloaded); their messages go again in 10 s, then after twice as long each time, at most 5 min" },
	]);
	assert.deepEqual(
		box.messages().map((message) => message.content),
		["[via telegram] Go.", `${AGAIN_MARK} Go.`, `${AGAIN_MARK} Go.`, `${AGAIN_MARK} Go.`],
	);
	assert.deepEqual(box.emitted("coordinator-replied"), []);
});

test("the notice after 3 turns without a reply never repeats a credential in omp's error", async (t) => {
	t.after(() => delete process.env.ARTHUR_INBOX_TEST_API_KEY);
	process.env.ARTHUR_INBOX_TEST_API_KEY = "hunter-two-secret";
	const error = "401 invalid x-api-key sk-ant-api03-AbCdEf123456 (hunter-two-secret), request_id req_011CgAWsav66AwnrHwNLjFA6";
	const box = await load(t, { steps: [...FAILED, ...FAILED, { prompt: true }, { message: "", stopReason: "error", error }, { end: true }, { prompt: true }] });
	await box.start();
	box.say("Go.");
	await until("the notice", () => box.emitted("notice").length === 1);
	assert.deepEqual(box.emitted("notice"), [
		{ text: "the coordinator's last 3 turns ended without a reply (error: 401 invalid x-api-key [redacted] ([redacted]), request_id [redacted]); their messages go again in 10 s, then after twice as long each time, at most 5 min" },
	]);
});

test("a reply ends the wait: the next turn that ends without a reply has its messages go again at once", async (t) => {
	const steps: AgentStep[] = [...FAILED, ...FAILED, { prompt: true }, { message: "Done." }, { end: true }, ...FAILED, { prompt: true }, { message: "Again." }, { end: true }, { prompt: true }];
	const box = await load(t, { steps });
	await box.start();
	const first = box.say("Go.");
	await deliveries(box, 3);
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	const second = box.say("Again?");
	// The first three are already in: only the gap between the fourth and the fifth is a wait.
	const [, , , quick = 0] = await deliveries(box, 5);
	assert.ok(quick < 4000, `the first redelivery after a reply is quick: ${quick}`);
	await until("the second reply", () => box.emitted("coordinator-replied").length === 2);
	assert.deepEqual(
		box.messages().map((message) => message.content),
		["[via telegram] Go.", `${AGAIN_MARK} Go.`, `${AGAIN_MARK} Go.`, "[via telegram] Again?", `${AGAIN_MARK} Again?`],
	);
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: "Done.", answers: [first], channels: ["telegram"] },
		{ text: "Again.", answers: [second], channels: ["telegram"] },
	]);
	assert.deepEqual(box.emitted("notice"), []);
});

test("a new owner message ends the wait: the waiting messages and the new one go at the next tick; a message from Arthur waits with them", async (t) => {
	// Three failed turns: the wait is 10 s, far longer than the next tick even on a slow runner.
	const box = await load(t, { steps: [...FAILED, ...FAILED, ...FAILED, { prompt: true }, { message: "Done." }, { end: true }, { prompt: true }] });
	await box.start();
	const first = box.say("Go.");
	await deliveries(box, 3);
	const scheduled = box.fake.emit("coordinator-message", { text: "Write the morning report." }).seq;
	await sleep(2000);
	assert.equal(box.messages().length, 3, "a message from Arthur does not end the wait");
	const saidAt = Date.now();
	const second = box.say("Now?");
	await until("the fourth delivery", () => box.messages().length === 4);
	assert.ok(Date.now() - saidAt < 5000, `the owner's message goes at the next tick, not in about 8 s at the wait's end: ${Date.now() - saidAt}`);
	assert.equal(box.messages()[3]?.content, [`${AGAIN_MARK} Go.`, "[Arthur] Write the morning report.", "[via telegram] Now?", ARTHUR].join("\n\n"));
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [first, scheduled, second], channels: ["telegram"] }]);
});

test("the wait before a failed turn's messages go again is none the first time, then 5 s doubling, at most 5 min", () => {
	assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 50].map(pause), [0, 5000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000, 300_000]);
});

test("a coordinator restarted mid-turn gets the message once more, marked, answers it once, and never a third time", async (t) => {
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
		{ content: "[via telegram] Start AR0081.", step: 0 },
		{ content: `[via telegram, ${RESTART}] Start AR0081.`, step: 0 },
	]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
	assert.equal(box.starts().length, 2);
});

test("at the start, a message left in turn/ that a written reply answers is answered, not delivered; another goes again; old files are pruned", async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Redone." }, { end: true }, { prompt: true }] });
	const file = (path: string, text: string, age = 0) => {
		mkdirSync(dirname(join(box.folder, path)), { recursive: true });
		writeFileSync(join(box.folder, path), text);
		const at = new Date(Date.now() - age);
		utimesSync(join(box.folder, path), at, at);
	};
	file("inbox/turn/107", JSON.stringify({ channel: "telegram", text: "Answered before the restart." }));
	file("inbox/turn/108", JSON.stringify({ channel: "telegram", text: "Not answered." }));
	file("outbox/sent/1000-000001.json", JSON.stringify({ text: "Done.", answers: [107], channels: ["telegram"] }));
	// Named by number and time since AR0135: a reply answers its own file, never another event of that number from a cut log.
	file("inbox/turn/109-2000", JSON.stringify({ channel: "telegram", text: "Answered, named by time." }));
	file("inbox/turn/107-3000", JSON.stringify({ channel: "telegram", text: "A new 107." }));
	// A reply the silent mode held answers its files too.
	file("outbox/held/1001-000001.json", JSON.stringify({ text: "Done too.", answers: ["109-2000"], channels: [] }));
	file("outbox/sent/0999-000001.json", JSON.stringify({ text: "Old.", answers: [100], channels: ["telegram"] }), 8 * DAY);
	file("inbox/answered/100", "{}", 8 * DAY);
	file("inbox/answered/101", "{}", 6 * DAY);
	await box.start();
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [{ content: `[via telegram, ${RESTART}] A new 107.\n\n[via telegram, ${RESTART}] Not answered.`, step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Redone.", answers: [107, 108], channels: ["telegram"] }]);
	assert.deepEqual(sorted(join(box.folder, "inbox", "answered")), ["101", "107", "107-3000", "108", "109-2000"]);
	assert.deepEqual(sorted(join(box.folder, "outbox", "sent")).filter((name) => name.startsWith("09") || name.startsWith("1000")), ["1000-000001.json"]);
});

test("the footer names the running jobs while one runs and is cleared when none runs", async (t) => {
	const root = repository();
	const gate = gates();
	const box = await load(t, { steps: [{ prompt: true }, { prompt: true }] }, { root });
	await box.start();
	await until("the coordinator's start", () => box.starts().length === 1);
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ waitFor: gate.at("job") }, { message: "Done." }] }))}${delimiter}${PATH}`;
	const job = await box.fake.host.jobs.spawn({ task: "Go." });
	const status = () => box.ui().filter((call) => call.method === "setStatus").map((call) => call.args);
	await until("the footer", () => status().length === 1);
	assert.deepEqual(status(), [["arthur", `arthur · 1 working: ${job.id.split("-").at(-1)}`]]);
	gate.open("job");
	// As arthur run delivers the wrapper's event.
	box.fake.emit("job-ended", await jobEnded(box.fake));
	await until("the footer cleared", () => status().length === 2);
	assert.deepEqual(status()[1], ["arthur", null]);
});

test("one event queued twice, and again after its file moved to turn/ and answered/, leaves one file; a new event of that number after a cut log is queued", () => {
	const folder = temporaryFolder();
	const inbox = (step: string) => sorted(join(folder, "inbox", step));
	const event = { seq: 5, time: "2026-10-18T10:00:00.000Z" };
	const name = `5-${Date.parse(event.time)}`;
	queue(folder, event, { channel: "telegram", text: "Hi." });
	queue(folder, event, { channel: "telegram", text: "Hi." });
	assert.deepEqual([inbox("queued"), readFileSync(join(folder, "inbox", "queued", name), "utf8")], [[name], '{"channel":"telegram","text":"Hi."}']);
	for (const [from, to] of [["queued", "turn"], ["turn", "answered"]]) {
		mkdirSync(join(folder, "inbox", to ?? ""));
		execFileSync("mv", [join(folder, "inbox", from ?? "", name), join(folder, "inbox", to ?? "", name)]);
		queue(folder, event, { channel: "telegram", text: "Hi." });
		assert.deepEqual([inbox("queued"), inbox("turn"), inbox("answered")], [[], to === "turn" ? [name] : [], to === "answered" ? [name] : []]);
	}
	assert.deepEqual(readdirSync(join(folder, "inbox")).sort(), ["answered", "queued", "turn"], "no draft left behind");
	// The log cut by hand starts its numbers again: event 5 of the new log is another message.
	queue(folder, { seq: 5, time: "2026-10-19T08:00:00.000Z" }, { channel: "telegram", text: "New." });
	assert.deepEqual(inbox("queued"), [`5-${Date.parse("2026-10-19T08:00:00.000Z")}`]);
});

test("a malformed message-received or coordinator-message queues nothing and logs one line each", async (t) => {
	const box = await load(t, { steps: [] });
	const text = { kind: "text", text: "Hi.", mime: "text/plain" };
	for (const data of [{ parts: [text] }, { channel: "telegram", text: "Hi." }, { channel: "telegram", parts: [{ ...text, text: "  " }] }, null]) box.fake.emit("message-received", data);
	for (const data of [{}, { text: 3 }]) box.fake.emit("coordinator-message", data);
	assert.deepEqual(box.errors, [
		"orchestration: message-received (event 1) ignored: expected channel, non-empty text, got nothing",
		"orchestration: message-received (event 2) ignored: expected parts, a list of at least one part, got nothing",
		"orchestration: message-received (event 3) ignored: parts[0]: expected { kind: text | photo | video | voice | audio | file, mime, text (a text part) or path (any other), seconds? }",
		"orchestration: message-received (event 4) ignored: expected channel, non-empty text, got nothing",
		...[5, 6].map((seq) => `orchestration: coordinator-message (event ${seq}) ignored: expected { text }, non-empty text`),
	]);
	assert.equal(existsSync(join(box.folder, "inbox")), false);
});

const PHOTO = { kind: "photo", path: "/home/arthur/.arthur/telegram/media/AQAD.jpg", mime: "image/jpeg" };
const VOICE = { kind: "voice", path: "/home/arthur/.arthur/telegram/media/AwAD.oga", mime: "audio/ogg", seconds: 4 };
const said = (text: string) => ({ kind: "text", text, mime: "text/plain" });

test("a message's parts are one turn, each part's text in order; a voice note with no plugin is its line, also sent back where it came from", async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Seen." }, { end: true }, { prompt: true }] });
	await box.start();
	const seq = box.fake.emit("message-received", { channel: "telegram", parts: [PHOTO, VOICE, said("What is it?")], place: "12" }).seq;
	await until("the reply", () => box.emitted("coordinator-replied").length === 2);
	assert.deepEqual(box.messages(), [{ content: `[via telegram] [photo, image/jpeg] (${PHOTO.path})\n${NOT_TRANSCRIBED}\nWhat is it?`, step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: NOT_TRANSCRIBED, answers: [seq], channels: ["telegram"], place: "12" },
		{ text: "Seen.", answers: [seq], channels: ["telegram"] },
	]);
});

test("a text right after a voice note whose claim is slow reaches the coordinator after it", async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Both." }, { end: true }, { prompt: true }] });
	const claim = Promise.withResolvers<{ text: string }>();
	box.fake.provide("message.part", (part: { kind: string }) => (part.kind === "voice" ? claim.promise : undefined));
	await box.start();
	const voice = box.fake.emit("message-received", { channel: "telegram", parts: [VOICE] }).seq;
	const text = box.say("And merge it.");
	// Every step a text alone needs runs in microtasks: had it overtaken the voice note, it would be queued by now.
	await new Promise(setImmediate);
	assert.deepEqual([box.resolved(voice), box.resolved(text), existsSync(join(box.folder, "inbox", "queued"))], [false, false, false]);
	claim.resolve({ text: "[voice 4 s] Start AR0081." });
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [{ content: "[via telegram] [voice 4 s] Start AR0081.\n\n[via telegram] And merge it.", step: 0 }]);
});

test("owner messages received before the start, as a restart leaves them, are resolved at the start in order; a broken one is set aside", async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Both." }, { end: true }, { prompt: true }] });
	const waiting = join(box.folder, "inbox", "received");
	const first = box.say("Before the start.");
	const second = box.say("Also before it.");
	writeFileSync(join(waiting, "0-1000"), "{ not json");
	writeFileSync(join(waiting, "3-1000"), JSON.stringify({ channel: "telegram", text: "the old shape" }));
	assert.deepEqual([box.resolved(first), box.resolved(second), existsSync(join(box.folder, "inbox", "queued"))], [false, false, false]);
	await box.start();
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [{ content: "[via telegram] Before the start.\n\n[via telegram] Also before it.", step: 0 }]);
	assert.deepEqual(sorted(waiting), ["0-1000.broken", "3-1000.broken"]);
	assert.deepEqual(box.errors, [
		`orchestration: ${join(waiting, "0-1000")} does not parse; set aside as ${join(waiting, "0-1000")}.broken`,
		`orchestration: ${join(waiting, "3-1000")} expected parts, a list of at least one part, got nothing; set aside as ${join(waiting, "3-1000")}.broken`,
	]);
});

// The inbox alone on a fake host, its owner's parts claimed by `claim`; each `start` stops the last run and starts another, as
// `arthur run` restarted on the same folder.
function restarts(t: TestContext, claim: (part: { kind: string }) => unknown) {
	const fake = fakeHost({ name: "orchestration" });
	fake.provide("message.part", claim);
	let run: { start(): void; stop(): void } | undefined;
	t.after(() => run?.stop());
	return {
		fake,
		start() {
			run?.stop();
			run = inbox(fake.host);
			run.start();
		},
		replies: () => fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => event.data),
		queued: () => sorted(join(fake.host.folder, "inbox", "queued")).map((name) => [name, JSON.parse(readFileSync(join(fake.host.folder, "inbox", "queued", name), "utf8"))]),
	};
}

test("a restart after a claim's reply went out and before its message was queued sends each reply once and queues the message once", async (t) => {
	const AUDIO = { kind: "audio", path: "/home/arthur/.arthur/telegram/media/AwAE.mp3", mime: "audio/mpeg", seconds: 9 };
	// The first run's pass never gets past the audio's claim, the voice note's reply already sent: as a restart cuts it.
	let cut = true;
	const box = restarts(t, (part) => (part.kind === "voice" ? { text: "[voice 4 s] Start AR0081.", reply: "Heard: Start AR0081." } : cut ? Promise.withResolvers<never>().promise : { text: "[audio 9 s] And merge it.", reply: "Heard: And merge it." }));
	box.start();
	const event = box.fake.emit("message-received", { channel: "telegram", parts: [VOICE, AUDIO], place: "12" });
	await until("the voice note's reply", () => box.replies().length === 1);
	cut = false;
	box.start();
	await until("the message queued", () => box.queued().length === 1);
	assert.deepEqual(box.replies(), [
		{ text: "Heard: Start AR0081.", answers: [event.seq], channels: ["telegram"], place: "12" },
		{ text: "Heard: And merge it.", answers: [event.seq], channels: ["telegram"], place: "12" },
	]);
	assert.deepEqual(box.queued(), [[`${event.seq}-${Date.parse(event.time)}`, { channel: "telegram", text: "[voice 4 s] Start AR0081.\n[audio 9 s] And merge it." }]]);
	assert.deepEqual(sorted(join(box.fake.host.folder, "inbox", "received")), []);
});

test("a message left in received/ from before a log cut by hand gets its claim's reply, though the new log holds one to its number", async (t) => {
	const box = restarts(t, () => ({ text: "[voice 4 s] Start AR0081.", reply: "Heard." }));
	// The new log's own event of that number, and a reply to it.
	const seq = box.fake.emit("job-state", {}).seq;
	box.fake.emit("coordinator-replied", { text: "To the new one.", answers: [seq], channels: ["telegram"] });
	mkdirSync(join(box.fake.host.folder, "inbox", "received"), { recursive: true });
	writeFileSync(join(box.fake.host.folder, "inbox", "received", `${seq}-1000`), JSON.stringify({ channel: "telegram", parts: [VOICE] }));
	box.start();
	await until("the message queued", () => box.queued().length === 1);
	assert.deepEqual(box.replies(), [{ text: "Heard.", answers: [seq], channels: ["telegram"] }]);
	assert.deepEqual(box.queued(), [[`${seq}-1000`, { channel: "telegram", text: "[voice 4 s] Start AR0081." }]]);
});

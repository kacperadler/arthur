import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, type AgentStep, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { queue } from "../src/inbox.ts";
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

const lines = (file: string): Record<string, unknown>[] => (existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []);
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
		say: (text: string, channel = "telegram") => fake.emit("message-received", { channel, text }).seq,
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
	assert.deepEqual(sorted(join(box.folder, "inbox", "answered")), [String(first), String(second)].sort());
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
	const box = await load(t, { steps: [{ prompt: true }, { message: "All three." }, { end: true }, { prompt: true }] });
	await box.start();
	// The footer is the sign the extension ticks.
	writeFileSync(join(box.folder, "footer"), "arthur · ready");
	await until("the extension's first tick", () => box.ui().length > 0);
	const numbers: number[] = [];
	for (const text of ["One.", "Two.", "Three.", "Four."]) {
		numbers.push(box.say(text));
		await sleep(300);
	}
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
	box.fake.provide("coordinator.wake", (job: { kind: string }) => (job.kind === "worker" ? "Procedure: review its branch against the ticket." : undefined));
	const result = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n");
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: result }] }))}${delimiter}${PATH}`;
	const job = await box.fake.host.jobs.spawn({ task: "Go." });
	await until("the job's end", () => box.fake.host.jobs.result(job.id) !== "" && box.fake.host.jobs.running().length === 0);
	const ended = box.fake.host.events.read(1).find((event) => event.name === "job-ended")?.data as Record<string, unknown>;
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
		"Procedure: review its branch against the ticket.",
		"",
		"[Arthur] Job 2026-10-17-worker-0000abcd ended its run: blocked (user: may I?).",
		"Project: shop.",
		"Its final message: none.",
		"Procedure: review its branch against the ticket.",
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

test("a hand-over that throws is retried each tick; the third failure in a row is told once, and the next try delivers once", async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Done." }, { end: true }, { prompt: true }], failSends: 3 });
	await box.start();
	const said = box.say("Go.");
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.emitted("notice"), [
		{ text: "the coordinator's inbox could not hand 1 message(s) to the agent 3 times in a row (fake agent: sendUserMessage failed); it keeps trying every 0.5 s" },
	]);
	assert.deepEqual(box.messages(), [{ content: "[via telegram] Go.", step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Done.", answers: [said], channels: ["telegram"] }]);
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
	file("outbox/sent/0999-000001.json", JSON.stringify({ text: "Old.", answers: [100], channels: ["telegram"] }), 8 * DAY);
	file("inbox/answered/100", "{}", 8 * DAY);
	file("inbox/answered/101", "{}", 6 * DAY);
	await box.start();
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [{ content: `[via telegram, ${RESTART}] Not answered.`, step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Redone.", answers: [108], channels: ["telegram"] }]);
	assert.deepEqual(sorted(join(box.folder, "inbox", "answered")), ["101", "107", "108"]);
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
	assert.deepEqual(status(), [["arthur", `arthur · 1 running: ${job.id.split("-").at(-1)}`]]);
	gate.open("job");
	await until("the job's end", () => box.fake.host.jobs.running().length === 0);
	// As arthur run delivers the wrapper's event.
	box.fake.emit("job-ended", box.fake.host.events.read(1).find((event) => event.name === "job-ended")?.data);
	await until("the footer cleared", () => status().length === 2);
	assert.deepEqual(status()[1], ["arthur", null]);
});

test("one event queued twice, and again after its file moved to turn/ and answered/, leaves one file", () => {
	const folder = temporaryFolder();
	const inbox = (step: string) => sorted(join(folder, "inbox", step));
	queue(folder, 5, { channel: "telegram", text: "Hi." });
	queue(folder, 5, { channel: "telegram", text: "Hi." });
	assert.deepEqual([inbox("queued"), readFileSync(join(folder, "inbox", "queued", "5"), "utf8")], [["5"], '{"channel":"telegram","text":"Hi."}']);
	for (const [from, to] of [["queued", "turn"], ["turn", "answered"]]) {
		mkdirSync(join(folder, "inbox", to ?? ""));
		execFileSync("mv", [join(folder, "inbox", from ?? "", "5"), join(folder, "inbox", to ?? "", "5")]);
		queue(folder, 5, { channel: "telegram", text: "Hi." });
		assert.deepEqual([inbox("queued"), inbox("turn"), inbox("answered")], [[], to === "turn" ? ["5"] : [], to === "answered" ? ["5"] : []]);
	}
	assert.deepEqual(readdirSync(join(folder, "inbox")).sort(), ["answered", "queued", "turn"], "no draft left behind");
});

test("a malformed message-received or coordinator-message queues nothing and logs one line each", async (t) => {
	const box = await load(t, { steps: [] });
	for (const data of [{ text: "Hi." }, { channel: 5, text: "Hi." }, { channel: "telegram", text: "  " }, null]) box.fake.emit("message-received", data);
	for (const data of [{}, { text: 3 }]) box.fake.emit("coordinator-message", data);
	assert.deepEqual(box.errors, [
		...[1, 2, 3, 4].map((seq) => `orchestration: message-received (event ${seq}) ignored: expected { channel, text }, both non-empty text`),
		...[5, 6].map((seq) => `orchestration: coordinator-message (event ${seq}) ignored: expected { text }, non-empty text`),
	]);
	assert.equal(existsSync(join(box.folder, "inbox")), false);
});

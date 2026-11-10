import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { type AgentRun, type AgentStep, fakeAgent, type FakeHost, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";
import { endCoordinator } from "./coordinator-end.ts";

// The inbox test files' shared setup: the plugin on a fake host, its coordinator a fake agent in a tmux server of the test's.

export const PATH = process.env.PATH ?? "";
export const AGAIN = "Your reply above has not been sent; write one reply that answers this together with everything your reply above answered.";
export const ARTHUR = "The messages marked [Arthur] or [Arthur: <plugin>] come from Arthur (a job's end, a plugin), not from the owner.";
// The decision log's line of a wake blocked on the owner whose question shop's log does not hold (decision-hooks.ts).
export const NOT_YET = "Its question was not in the decision log yet: arthur decisions --kind job --project shop shows its id. Open, record the owner's answer first, arthur decision answer <its id> --decided '<the decision in one line>' '<his words>', then arthur continue 2026-10-17-worker-0000abcd '<his answer>'; answered by policy, the plugin continues the job with that decision by itself: say so in your reply.";
export const RESTART = "sent before a restart; no reply to it was sent";
export const DAY = 24 * 3_600_000;

// Files a fake's `waitFor` steps wait for.
export function gates() {
	const folder = temporaryFolder();
	return { at: (name: string) => join(folder, name), open: (name: string) => writeFileSync(join(folder, name), "") };
}

// A clock file for the fake agent's `clock`: its `Date.now()` stands still where the test puts it, so no stalled runner moves it.
export function agentClock() {
	const file = join(temporaryFolder(), "clock");
	let now = Date.now();
	const move = (ms: number) => {
		writeFileSync(`${file}.new`, String((now += ms)));
		renameSync(`${file}.new`, file);
	};
	move(0);
	return { file, move };
}

// Whole lines only: a line the agent is still appending has no line break yet.
const lines = (file: string): Record<string, unknown>[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line)) : []);
export const sorted = (folder: string) => (existsSync(folder) ? readdirSync(folder).sort() : []);

// The plugin on a fake host with `projects` provided, if given, and its coordinator the fake agent playing `run` in a tmux
// server on a socket in the test's folder, killed when the test ends; `start` puts that agent on `PATH` and starts the plugin.
export async function load(t: TestContext, run: AgentRun, setup: { readonly root?: string; readonly projects?: readonly unknown[]; readonly env?: Record<string, string> } = {}) {
	const agent = fakeAgent(run);
	const socket = join(temporaryFolder(), "tmux.sock");
	const options = { coordinator: { exitWaitSeconds: 1, restartDelaySeconds: 1, tmux: { session: "coord", socket } } };
	const errors: string[] = [];
	t.mock.method(console, "log", () => {});
	t.mock.method(console, "error", (text: string) => void errors.push(text));
	const fake = fakeHost({ name: "orchestration", root: setup.root, env: setup.env });
	if (setup.projects !== undefined) fake.provide("projects", () => setup.projects);
	const plugin = orchestration(options);
	await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	t.after(() => void (process.env.PATH = PATH));
	endCoordinator(t, socket, plugin);
	const folder = fake.host.folder;
	const ui = () => lines(join(dirname(agent), "ui.jsonl"));
	let ticks = 0;
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
		ui,
		ends: () => lines(join(dirname(agent), "ends.jsonl")),
		// Two ticks of the inbox extension, each seen by the footer it shows: by the second, the first ran whole, at the agent's clock as it is now.
		async ticked() {
			for (const _ of [1, 2]) {
				const seen = ui().length;
				writeFileSync(join(folder, "footer"), `arthur · tick ${++ticks}`);
				await until("a tick", () => ui().length > seen);
			}
		},
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
export function repository(): string {
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
export async function jobEnded(fake: FakeHost): Promise<unknown> {
	let data: unknown;
	await until("the job's job-ended", () => (data = fake.host.events.read(1).find((event) => event.name === "job-ended")?.data) !== undefined);
	return data;
}

// What the backoff tests drive of a loaded plugin, its agent on `move`'s clock.
type Driven = { readonly folder: string; messages(): unknown[]; ends(): unknown[]; ticked(): Promise<void>; say(text: string): number; resolved(seq: number): boolean };
// Says `text` and sees it handed over once the queue settled a second on the agent's clock, which then stands still.
export async function handed(box: Driven, move: (ms: number) => void, text: string): Promise<number> {
	const count = box.messages().length;
	const seq = box.say(text);
	await until(`${text} queued`, () => box.resolved(seq));
	await box.ticked();
	move(1000);
	await until(`${text} handed over`, () => box.messages().length === count + 1);
	return seq;
}
// Once the turn of the last delivery ended without a reply: no delivery 1 ms before `ms` on the agent's clock, and one at `ms`.
export async function goesAgain(box: Driven, move: (ms: number) => void, ms: number): Promise<void> {
	const count = box.messages().length;
	await until(`turn ${count}'s end`, () => box.ends().length === count);
	if (ms > 0) {
		move(ms - 1);
		await box.ticked();
		assert.equal(box.messages().length, count, `no delivery 1 ms before ${ms} ms on the agent's clock, however long in real time`);
		move(1);
	}
	await box.ticked();
	assert.equal(box.messages().length, count + 1, `delivery ${count + 1} at ${ms} ms on the agent's clock`);
}
export const FAILED: AgentStep[] = [{ prompt: true }, { message: "", stopReason: "error", error: "overloaded" }, { end: true }];
export const AGAIN_MARK = "[via telegram, sent before; its turn ended without a reply]";

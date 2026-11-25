import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import type { Event } from "@arthur/core/plugin";
import { fakeHost, until } from "@arthur/core/testing";
import { handOver } from "../src/hand-over.ts";
import extension from "../src/inbox-extension.ts";
import { inbox } from "../src/inbox.ts";
import type { Box, Chat } from "../src/sessions.ts";

// AR0706 (roadmap 86): each session's inbox, the plugin's side on a fake host and the extension's in this process: shop's
// agent talks in topic 42 of Telegram's bot `shop`, blog's in Discord's channel 7.

const SHOP: Chat = { plugin: "telegram", instance: "shop", place: "42" };
const BLOG: Chat = { plugin: "discord", place: "7" };
const FROM = "The messages marked [from <session>] come from another session of Arthur's (arthur agent tell), not from the owner.";
const ARTHUR = "The messages marked [Arthur] or [Arthur: <plugin>] come from Arthur (a job's end, a plugin), not from the owner.";
const list = (dir: string) => (existsSync(dir) ? readdirSync(dir).sort() : []);
// The line Arthur puts under each reply it sends, when no job is in a run (context.ts, `jobsNow`).
const NONE = "\n\nJobs now: none";

// The inbox alone, `agents` its project agents; `replay` hands an event again to its handlers, as `arthur run` does after a
// crash, or as another process that got it does.
function routed(t: TestContext, agents: Readonly<Record<string, Chat>> = { shop: SHOP, blog: BLOG }) {
	const fake = fakeHost({ name: "orchestration" });
	const handlers: [string, (event: Event) => void][] = [];
	const events = { ...fake.host.events, on: (name: string, fn: (event: Event) => void) => (handlers.push([name, fn]), fake.host.events.on(name, fn)) };
	const folder = (session = "coordinator") => (session === "coordinator" ? fake.host.folder : join(fake.host.folder, "agents", session));
	const sessions: Box[] = [{ name: "coordinator", folder: folder() }, ...Object.entries(agents).map(([project, chat]) => ({ name: `agent:${project}`, project, chat, folder: folder(project) }))];
	const run = inbox({ ...fake.host, events }, sessions);
	t.after(() => run.stop());
	const box = (session: string | undefined, step: string) => join(folder(session), "inbox", step);
	return {
		fake,
		run,
		folder,
		// The messages in `step` of a session's inbox, by file name.
		inbox: (session?: string, step = "queued") => Object.fromEntries(list(box(session, step)).map((name) => [name, JSON.parse(readFileSync(join(box(session, step), name), "utf8"))])),
		move: (session: string | undefined, name: string, from: string, to: string) => {
			mkdirSync(box(session, to), { recursive: true });
			renameSync(join(box(session, from), name), join(box(session, to), name));
		},
		name: (event: Event) => `${event.seq}-${Date.parse(event.time)}`,
		replay: (event: Event) => {
			for (const [name, fn] of handlers) if (name === event.name) fn(event);
		},
	};
}

const said = (text: string, where: Readonly<Record<string, string>> = {}) => ({ ...where, parts: [{ kind: "text", text, mime: "text/plain" }] });

test("a message in a project agent's chat goes to its inbox; the main chat, another place, another bot or another channel's place to the coordinator's", async (t) => {
	const box = routed(t);
	box.run.start();
	const sent = [
		box.fake.emit("message-received", said("For shop.", { channel: "telegram", instance: "shop", place: "42" })),
		box.fake.emit("message-received", said("For blog.", { channel: "discord", place: "7" })),
		box.fake.emit("message-received", said("The main chat.", { channel: "telegram" })),
		box.fake.emit("message-received", said("Another topic.", { channel: "telegram", instance: "shop", place: "43" })),
		box.fake.emit("message-received", said("The main bot's topic 42.", { channel: "telegram", place: "42" })),
		box.fake.emit("message-received", said("Telegram's 7.", { channel: "telegram", place: "7" })),
	];
	await until("every message queued", () => list(join(box.folder(), "inbox", "received")).length === 0 && Object.keys(box.inbox()).length === 4);
	const [shop, blog, ...rest] = sent.map(box.name);
	assert.deepEqual(box.inbox("shop"), { [shop ?? ""]: { channel: "telegram", text: "For shop." } });
	assert.deepEqual(box.inbox("blog"), { [blog ?? ""]: { channel: "discord", text: "For blog." } });
	assert.deepEqual(Object.keys(box.inbox()), rest);
});

test("a job's end and a plugin's message naming a project wake its agent, any other the coordinator; a tell goes to the session it names", (t) => {
	const box = routed(t);
	const end = (project: string) => box.fake.emit("job-ended", { id: "2026-01-01-worker-0000000a", kind: "worker", project, state: "ended", reason: "finished" });
	const [shop, docs] = [end("shop"), end("docs")];
	const [blog, none] = [box.fake.emit("coordinator-message", { text: "CI failed on blog.", project: "blog" }), box.fake.emit("coordinator-message", { text: "Write the morning report." })];
	const told = box.fake.emit("agent-told", { to: "agent:shop", from: "coordinator", text: "Ship the cart." });
	const gone = box.fake.emit("agent-told", { to: "agent:gone", from: "agent:blog", text: "For a removed agent." });
	const wake = "Job 2026-01-01-worker-0000000a ended its run: ended (finished).\nIts final message: none.";
	assert.deepEqual(box.inbox("shop"), { [box.name(shop)]: { text: wake }, [box.name(told)]: { from: "coordinator", text: "Ship the cart." } });
	assert.deepEqual(box.inbox("blog"), { [box.name(blog)]: { plugin: "test", text: "CI failed on blog." } });
	assert.deepEqual(box.inbox(), { [box.name(docs)]: { text: wake }, [box.name(none)]: { plugin: "test", text: "Write the morning report." }, [box.name(gone)]: { from: "agent:blog", text: "For a removed agent." } });
});

test("nothing is queued twice across a restart of either session: each event replayed after its file moved on, in its session or another", async (t) => {
	const box = routed(t);
	box.run.start();
	const owner = box.fake.emit("message-received", said("For shop.", { channel: "telegram", instance: "shop", place: "42" }));
	await until("the owner's message queued", () => Object.keys(box.inbox("shop")).length === 1);
	const end = box.fake.emit("job-ended", { id: "2026-01-01-worker-0000000a", kind: "worker", project: "shop", state: "ended", reason: "finished" });
	const ci = box.fake.emit("coordinator-message", { text: "CI failed on blog.", project: "blog" });
	const told = box.fake.emit("agent-told", { to: "coordinator", from: "agent:shop", text: "Blog's turn." });
	box.move("shop", box.name(owner), "queued", "turn");
	box.move("shop", box.name(end), "queued", "answered");
	box.move("blog", box.name(ci), "queued", "turn");
	box.move(undefined, box.name(told), "queued", "answered");
	for (const event of [owner, end, ci, told]) box.replay(event);
	box.run.stop();
	assert.deepEqual([box.inbox("shop"), box.inbox("blog"), box.inbox(), box.inbox(undefined, "received")], [{}, {}, {}, {}]);
});

test("at the start, a removed agent's queued and handed messages move to the coordinator's queue; its project's job then wakes the coordinator", (t) => {
	const box = routed(t, { blog: BLOG });
	const write = (session: string, step: string, name: string, message: object) => {
		mkdirSync(join(box.folder(session), "inbox", step), { recursive: true });
		writeFileSync(join(box.folder(session), "inbox", step, name), JSON.stringify(message));
	};
	write("shop", "queued", "5-1000", { channel: "telegram", text: "Waiting." });
	write("shop", "turn", "6-1000", { channel: "telegram", text: "Handed." });
	write("shop", "answered", "4-1000", { channel: "telegram", text: "Answered." });
	write("blog", "queued", "7-1000", { channel: "discord", text: "Blog's own." });
	box.run.start();
	assert.deepEqual(box.inbox(), { "5-1000": { channel: "telegram", text: "Waiting." }, "6-1000": { channel: "telegram", text: "Handed." } });
	assert.deepEqual([box.inbox("shop"), box.inbox("shop", "turn"), Object.keys(box.inbox("shop", "answered")), Object.keys(box.inbox("blog"))], [{}, {}, ["4-1000"], ["7-1000"]]);
	const end = box.fake.emit("job-ended", { id: "2026-01-01-worker-0000000a", kind: "worker", project: "shop", state: "ended", reason: "finished" });
	assert.deepEqual(Object.keys(box.inbox()), [box.name(end), "5-1000", "6-1000"]);
});

test("an agent's reply and notice go to its chat: its channel, bot and place; while silent its reply to the owner goes and one to Arthur alone is held", async (t) => {
	const box = routed(t);
	const write = (session: string | undefined, name: string, entry: object) => {
		mkdirSync(join(box.folder(session), "outbox"), { recursive: true });
		writeFileSync(join(box.folder(session), "outbox", `${name}.json`), JSON.stringify(entry));
	};
	writeFileSync(join(box.fake.host.folder, "silent.json"), JSON.stringify({ since: "2026-01-01T00:00:00.000Z", seq: 0, work: "the cart" }));
	write("shop", "1000-000001", { text: "Done.", answers: ["5-1000"], channels: ["telegram"] });
	write("shop", "1000-000002", { text: "The job ended.", answers: ["6-1000"], channels: [] });
	write("shop", "1000-000003", { notice: "shop's inbox could not hand 1 message(s) to the agent 3 times in a row" });
	write("blog", "1000-000001", { text: "Blog done.", answers: ["7-1000"], channels: ["discord"] });
	write(undefined, "1000-000001", { text: "Coordinator done.", answers: ["8-1000"], channels: ["telegram"] });
	write(undefined, "1000-000002", { notice: "the coordinator's notice" });
	box.run.start();
	box.run.stop();
	const emitted = (name: string) => box.fake.emitted.filter((event) => event.name === name).map((event) => event.data);
	assert.deepEqual(emitted("coordinator-replied"), [
		{ text: `Coordinator done.${NONE}`, answers: [8], channels: ["telegram"] },
		{ text: `Done.${NONE}`, answers: [5], channels: ["telegram"], place: "42", instance: "shop" },
		{ text: `Blog done.${NONE}`, answers: [7], channels: ["discord"], place: "7" },
	]);
	assert.deepEqual(emitted("notice"), [{ text: "the coordinator's notice" }, { text: "shop's inbox could not hand 1 message(s) to the agent 3 times in a row", channel: "telegram", instance: "shop", place: "42" }]);
	assert.deepEqual([list(join(box.folder("shop"), "outbox", "held")), list(join(box.folder("shop"), "outbox", "sent"))], [["1000-000002.json"], ["1000-000001.json", "1000-000003.json"]]);
});

// AR0739: the coordinator told the owner that no job was running while its own context listed a review as working.
test("each reply Arthur sends ends with the jobs not ended, read from their records as it goes out: by state, an agent's of its project alone; a notice and a held reply get no line", (t) => {
	const box = routed(t);
	const write = (session: string | undefined, name: string, entry: object) => {
		mkdirSync(join(box.folder(session), "outbox"), { recursive: true });
		writeFileSync(join(box.folder(session), "outbox", `${name}.json`), JSON.stringify(entry));
	};
	// A record as a spawn leaves it, the files the line reads; `spawned` orders them, the newest first.
	const record = (id: string, project: string, state: string, spawned: number) => {
		const job = join(box.folder(), "..", "jobs", id);
		mkdirSync(job, { recursive: true });
		for (const [name, text] of Object.entries({ kind: id.split("-")[3] ?? "", project, task: "Go.", ...(state === "" ? {} : { state }) })) writeFileSync(join(job, name), text);
		utimesSync(join(job, "kind"), spawned, spawned);
	};
	const replies = () => box.fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => (event.data as { text: string }).text);
	write(undefined, "1000-000001", { text: "No job runs.", answers: ["8-1000"], channels: ["telegram"] });
	box.run.start();
	box.run.stop();
	assert.deepEqual(replies(), [`No job runs.${NONE}`]);
	record("2026-01-01-review-953209e8", "arthur", "working", 5);
	record("2026-01-01-worker-0a1b2c3d", "shop", "blocked", 4);
	record("2026-01-01-worker-1b2c3d4e", "shop", "working", 3);
	record("2026-01-01-worker-2c3d4e5f", "shop", "ended", 2);
	record("2026-01-01-audit-3d4e5f60", "arthur", "", 1);
	writeFileSync(join(box.fake.host.folder, "silent.json"), JSON.stringify({ since: "2026-01-01T00:00:00.000Z", seq: 0, work: "the cart", until: "2026-01-02T00:00:00.000Z" }));
	write(undefined, "2000-000001", { text: "No job runs,\nI think.", answers: ["9-1000"], channels: ["telegram"] });
	write(undefined, "2000-000002", { text: "A review ended.", answers: ["10-1000"], channels: [] });
	write(undefined, "2000-000003", { notice: "the coordinator's notice" });
	write("shop", "2000-000001", { text: "Shop's status.", answers: ["11-1000"], channels: ["telegram"] });
	write("blog", "2000-000001", { text: "Blog's status.", answers: ["12-1000"], channels: ["discord"] });
	box.run.stop();
	assert.deepEqual(replies().slice(1), [
		"No job runs,\nI think.\n\nJobs now: 1 blocked (worker 0a1b2c3d), 2 working (review 953209e8, worker 1b2c3d4e), 1 no state (audit 3d4e5f60)",
		"Shop's status.\n\nJobs now: 1 blocked (worker 0a1b2c3d), 1 working (worker 1b2c3d4e)",
		`Blog's status.${NONE}`,
	]);
	assert.deepEqual(box.fake.emitted.filter((event) => event.name === "notice").map((event) => event.data), [{ text: "the coordinator's notice" }]);
	assert.deepEqual(JSON.parse(readFileSync(join(box.folder(), "outbox", "held", "2000-000002.json"), "utf8")), { text: "A review ended.", answers: ["10-1000"], channels: [] }, "held as it was written");
	// The line is the records' at that sweep, not the last one's: the review ended since.
	writeFileSync(join(box.folder(), "..", "jobs", "2026-01-01-review-953209e8", "state"), "ended");
	write(undefined, "3000-000001", { text: "And now?", answers: ["13-1000"], channels: ["telegram"] });
	box.run.stop();
	assert.equal(replies().at(-1), "And now?\n\nJobs now: 1 blocked (worker 0a1b2c3d), 1 working (worker 1b2c3d4e), 1 no state (audit 3d4e5f60)");
});

// AR0713: an ask is its session's own, so a removed agent's goes to the coordinator with the reply it was run for.
test("while silent, a removed agent's ask moves to the coordinator's folder with its unsent reply, which is sent; a coordinator's own ask stays instead", (t) => {
	for (const own of [undefined, "3000"]) {
		const box = routed(t, {});
		const [ask, gone] = [join(box.folder(), "silent-ask"), join(box.folder("shop"), "silent-ask")];
		mkdirSync(join(box.folder("shop"), "outbox"), { recursive: true });
		writeFileSync(join(box.folder(), "silent.json"), JSON.stringify({ since: "2026-01-01T00:00:00.000Z", seq: 0, work: "the cart" }));
		writeFileSync(gone, "1000");
		if (own !== undefined) writeFileSync(ask, own);
		writeFileSync(join(box.folder("shop"), "outbox", "2000-000001.json"), JSON.stringify({ text: "Shop: approve SH0001?", answers: ["4-1000"], channels: [] }));
		box.run.start();
		assert.deepEqual([existsSync(gone), existsSync(ask) && readFileSync(ask, "utf8")], own === undefined ? [false, "1000"] : [true, own]);
		box.run.stop();
		const replied = box.fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => event.data);
		assert.deepEqual([replied, existsSync(ask)], own === undefined ? [[{ text: `Shop: approve SH0001?${NONE}`, answers: [4], channels: [] }], false] : [[], true]);
	}
});

test("a message for an agent that is down waits in its inbox and is handed over once it is up, a tell marked [from] and given as Arthur's, not the owner's", async (t) => {
	const box = routed(t);
	const told = box.fake.emit("agent-told", { to: "agent:shop", from: "coordinator", text: "Ship the cart." });
	assert.deepEqual(Object.keys(box.inbox("shop")), [box.name(told)]);
	// The agent comes up: its extension in this process, on shop's folder.
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	process.env.ARTHUR_ORCHESTRATION_FOLDER = box.folder("shop");
	const handed: [string, unknown][] = [];
	const on = new Map<string, (event: object, ctx: object) => void>();
	extension({ on: (name: string, fn: (event: object, ctx: object) => void) => void on.set(name, fn), sendUserMessage: (content: string, options?: unknown) => void handed.push([content, options]) } as unknown as Parameters<typeof extension>[0]);
	let tick = () => {};
	on.get("session_start")?.({}, { hasUI: true, isIdle: () => true, ui: { setStatus() {} }, setInterval: (fn: () => void) => void (tick = fn) });
	await until("the hand-over", () => (tick(), handed.length > 0));
	assert.deepEqual(handed, [[`[from coordinator]\n> Ship the cart.\n\n${FROM}`, { attribution: "agent" }]]);
	assert.deepEqual([box.inbox("shop"), Object.keys(box.inbox("shop", "turn"))], [{}, [box.name(told)]]);
});

test("a turn's text marks a tell [from <session>]: Arthur's line only beside Arthur's own, the tell's line only beside a tell", () => {
	assert.equal(handOver([{ channel: "telegram", text: "Hi." }, { from: "agent:shop", text: "Blog's turn." }]), `[via telegram]\n> Hi.\n\n[from agent:shop]\n> Blog's turn.\n\n${FROM}`);
	assert.equal(handOver([{ text: "Job ended." }, { from: "coordinator", text: "Go." }]), `[Arthur]\n> Job ended.\n\n[from coordinator]\n> Go.\n\n${ARTHUR}\n\n${FROM}`);
	assert.equal(handOver([{ plugin: "github", text: "CI failed." }]), `[Arthur: github]\n> CI failed.\n\n${ARTHUR}`);
});

// The inbox.test.ts test of `coordinator.turn` needs a tmux server; this one holds where none can start.
test("coordinator.turn, on wake.ts: an owner's text message is its marked quote; a malformed one is refused", async (t) => {
	const box = routed(t);
	const turn = (...asked: unknown[]) => box.fake.call<Promise<string>>("coordinator.turn", ...asked);
	assert.equal(await turn("message-received", said("Merge it.", { channel: "telegram" })), "[via telegram]\n> Merge it.");
	await assert.rejects(turn("message-received", { parts: said("Hi.").parts }), { message: "coordinator.turn: message-received: expected channel, non-empty text, got nothing" });
});

test("an agent's reply to a turn of Arthur's messages alone names its chat's channel, so no other channel sends it; a removed agent's unsent reply goes out at the start, its turn's messages a reply answers stay", (t) => {
	const box = routed(t, { blog: BLOG });
	const file = (session: string, path: string, entry: object) => {
		mkdirSync(join(box.folder(session), path, ".."), { recursive: true });
		writeFileSync(join(box.folder(session), path), JSON.stringify(entry));
	};
	const write = (session: string, name: string, entry: object) => file(session, `outbox/${name}.json`, entry);
	write("blog", "1000-000001", { text: "Blog's job ended.", answers: ["6-1000"], channels: [] });
	file("coordinator", "outbox/sent/0998-000001.json", { text: "Sent before.", answers: [], channels: [] });
	// Shop's agent removed since it wrote these: a reply sent and one not, a notice, a draft, and its turn's messages.
	write("shop", "1000-000002", { text: "Shop's last reply.", answers: ["7-1000"], channels: ["telegram"] });
	write("shop", "1000-000003", { notice: "shop's notice" });
	file("shop", "outbox/sent/0999-000001.json", { text: "Shop's reply before.", answers: ["5-1000"], channels: ["telegram"] });
	// Held while silent: its reply to a job's end alone.
	file("shop", "outbox/held/0999-000002.json", { text: "Shop's job ended.", answers: ["4-1000"], channels: [] });
	file("shop", "outbox/.1000-000004", { text: "Half written." });
	file("shop", "inbox/turn/4-1000", { text: "Job ended." });
	for (const name of ["5-1000", "7-1000", "8-1000"]) file("shop", `inbox/turn/${name}`, { channel: "telegram", text: `Message ${name}.` });
	box.run.start();
	box.run.stop();
	const emitted = (name: string) => box.fake.emitted.filter((event) => event.name === name).map((event) => event.data);
	assert.deepEqual(emitted("coordinator-replied"), [
		{ text: `Shop's last reply.${NONE}`, answers: [7], channels: ["telegram"] },
		{ text: `Blog's job ended.${NONE}`, answers: [6], channels: ["discord"], place: "7" },
	]);
	assert.deepEqual(emitted("notice"), [{ text: "shop's notice" }]);
	// Its draft and its sent and held replies stay; its answered messages stay in its turn/, only the unanswered one is the coordinator's.
	const shop = (...path: string[]) => list(join(box.folder("shop"), ...path));
	assert.deepEqual([shop("outbox"), shop("outbox", "sent"), shop("outbox", "held"), shop("inbox", "turn")], [[".1000-000004", "held", "sent"], ["0999-000001.json"], ["0999-000002.json"], ["4-1000", "5-1000", "7-1000"]]);
	assert.deepEqual(box.inbox(), { "8-1000": { channel: "telegram", text: "Message 8-1000." } });
});

test("a chat that names no bot is its channel's main one, by the name channel.main answers, whose messages there reach the agent; another bot's go to the coordinator", async (t) => {
	const box = routed(t, { shop: { plugin: "test", place: "9" }, blog: { plugin: "test", instance: "second", place: "9" } });
	box.fake.provide("channel.main", () => "first");
	box.run.start();
	const say = (instance: string | undefined, text: string) => box.fake.emit("message-received", said(text, { channel: "test", place: "9", ...(instance === undefined ? {} : { instance }) }));
	const [first, second, unnamed] = [say("first", "By the main bot."), say("second", "By the second."), say(undefined, "By no bot of that name.")];
	await until("every message queued", () => list(join(box.folder(), "inbox", "received")).length === 0 && Object.keys(box.inbox()).length === 1);
	assert.deepEqual([Object.keys(box.inbox("shop")), Object.keys(box.inbox("blog")), Object.keys(box.inbox())], [[box.name(first)], [box.name(second)], [box.name(unnamed)]]);
});

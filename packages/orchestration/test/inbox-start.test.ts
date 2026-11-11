import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { NOT_TRANSCRIBED } from "@arthur/core/parts";
import { fakeHost, until } from "@arthur/core/testing";
import { inbox } from "../src/inbox.ts";
import { DAY, load, RESTART, sorted } from "./inbox-setup.ts";
import { NO_UNIX_SOCKET } from "./unix-socket.ts";

// The inbox at its start (inbox-setup.ts): what a restart left in its folders, and a message's parts.

test("at the start, a message left in turn/ that a written reply answers is answered, not delivered; another goes again; old files are pruned", { skip: NO_UNIX_SOCKET }, async (t) => {
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
	assert.deepEqual(box.messages(), [{ content: `[via telegram, ${RESTART}]\n> A new 107.\n\n[via telegram, ${RESTART}]\n> Not answered.`, step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [{ text: "Redone.", answers: [107, 108], channels: ["telegram"] }]);
	assert.deepEqual(sorted(join(box.folder, "inbox", "answered")), ["101", "107", "107-3000", "108", "109-2000"]);
	assert.deepEqual(sorted(join(box.folder, "outbox", "sent")).filter((name) => name.startsWith("09") || name.startsWith("1000")), ["1000-000001.json"]);
});

const PHOTO = { kind: "photo", path: "/home/arthur/.arthur/telegram/media/AQAD.jpg", mime: "image/jpeg" };
const VOICE = { kind: "voice", path: "/home/arthur/.arthur/telegram/media/AwAD.oga", mime: "audio/ogg", seconds: 4 };
const said = (text: string) => ({ kind: "text", text, mime: "text/plain" });

test("a message's parts are one turn, each part's text in order; a voice note with no plugin is its line, also sent back where it came from", { skip: NO_UNIX_SOCKET }, async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Seen." }, { end: true }, { prompt: true }] });
	await box.start();
	const seq = box.fake.emit("message-received", { channel: "telegram", parts: [PHOTO, VOICE, said("What is it?")], place: "12" }).seq;
	await until("the reply", () => box.emitted("coordinator-replied").length === 2);
	assert.deepEqual(box.messages(), [{ content: `[via telegram]\n> [photo, image/jpeg] (${PHOTO.path})\n> ${NOT_TRANSCRIBED}\n> What is it?`, step: 0 }]);
	assert.deepEqual(box.emitted("coordinator-replied"), [
		{ text: NOT_TRANSCRIBED, answers: [seq], channels: ["telegram"], place: "12" },
		{ text: "Seen.", answers: [seq], channels: ["telegram"] },
	]);
});

test("a text right after a voice note whose claim is slow reaches the coordinator after it", { skip: NO_UNIX_SOCKET }, async (t) => {
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
	assert.deepEqual(box.messages(), [{ content: "[via telegram]\n> [voice 4 s] Start AR0081.\n\n[via telegram]\n> And merge it.", step: 0 }]);
});

test("owner messages received before the start, as a restart leaves them, are resolved at the start in order; a broken one is set aside", { skip: NO_UNIX_SOCKET }, async (t) => {
	const box = await load(t, { steps: [{ prompt: true }, { message: "Both." }, { end: true }, { prompt: true }] });
	const waiting = join(box.folder, "inbox", "received");
	const first = box.say("Before the start.");
	const second = box.say("Also before it.");
	writeFileSync(join(waiting, "0-1000"), "{ not json");
	writeFileSync(join(waiting, "3-1000"), JSON.stringify({ channel: "telegram", text: "the old shape" }));
	assert.deepEqual([box.resolved(first), box.resolved(second), existsSync(join(box.folder, "inbox", "queued"))], [false, false, false]);
	await box.start();
	await until("the reply", () => box.emitted("coordinator-replied").length === 1);
	assert.deepEqual(box.messages(), [{ content: "[via telegram]\n> Before the start.\n\n[via telegram]\n> Also before it.", step: 0 }]);
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

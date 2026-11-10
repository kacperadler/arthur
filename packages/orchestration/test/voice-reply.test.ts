import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { NOT_TRANSCRIBED } from "@arthur/core/parts";
import { fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { inbox } from "../src/inbox.ts";
import { orchestration } from "../src/orchestration.ts";

// The coordinator's reply to a voice note, also sent as a voice note (AR0553): the test provides `speak.say` as the speak plugin
// would and `channel.send` as a channel would, both as the plugin `test`, so a message from the channel `test` is one whose
// channel sends files. Each reply is written to the outbox as the inbox extension writes it, and swept by the plugin's stop.

type Speak = ((text: string) => Promise<string>) | null;
type Send = (message: { files: string[]; place?: string }) => () => Promise<string>;

const VOICE = { kind: "voice", path: "/srv/media/note.ogg", mime: "audio/ogg", seconds: 4 };
const TEXT = { kind: "text", text: "And the budget?", mime: "text/plain" };

async function setup(speak: Speak, send: Send = () => async () => "sent 1 file in 1 message") {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", root]);
	const fake = fakeHost({ name: "orchestration", root });
	const [spoken, sent]: [string[], unknown[]] = [[], []];
	if (speak !== null) fake.provide("speak.say", (text: string) => (spoken.push(text), speak(text)));
	fake.provide("channel.send", (message: { files: string[]; place?: string }) => {
		const go = send(message);
		// A channel whose check answers something other than a send, as a broken one would.
		if (typeof go !== "function") return go;
		return async () => {
			const said = await go();
			sent.push(message);
			return said;
		};
	});
	const plugin = orchestration();
	await fake.setup(plugin);
	let written = 0;
	return {
		fake,
		spoken,
		sent,
		say: (channel: string, parts: readonly unknown[], place?: string) => fake.emit("message-received", { channel, parts, ...(place === undefined ? {} : { place }) }),
		// A reply as the inbox extension writes it, answering `events`, swept at once.
		async reply(text: string, events: readonly { readonly seq: number; readonly time: string }[], channels: readonly string[]) {
			mkdirSync(join(fake.host.folder, "outbox"), { recursive: true });
			const answers = events.map((event) => `${event.seq}-${Date.parse(event.time)}`);
			writeFileSync(join(fake.host.folder, "outbox", `${Date.now()}-${String(++written).padStart(6, "0")}.json`), JSON.stringify({ text, answers, channels }));
			await plugin.stop?.();
		},
		replies: () => fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => event.data),
	};
}

test("a reply to a voice note goes after its text as a voice note, through the channel it came from and, as the text, to no place; a reply to text alone does not", async () => {
	const box = await setup(async (text) => `/home/speak/${text.length}.ogg`);
	const typed = box.say("test", [TEXT], "7");
	// A voice note and a plugin's message after it in the log, which the replies below do not answer: never spoken for them.
	const unanswered = box.say("telegram", [VOICE]);
	const wake = box.fake.emit("coordinator-message", { text: "[scheduled docs] Check." });
	// Every other kind of file, with no voice note among them: answered by text alone.
	const media = box.say("test", ["photo", "video", "audio", "file"].map((kind) => ({ kind, path: `/srv/media/a.${kind}`, mime: "application/octet-stream", seconds: 4 })));
	await box.reply("Typed only.", [typed], ["test"]);
	await box.reply("Read the docs.", [wake], []);
	await box.reply("Media only.", [media], ["test"]);
	const spoken = box.say("test", [TEXT, VOICE], "12");
	await box.reply("Merged AR0081.", [typed, spoken], ["test"]);
	await until("the voice note", () => box.sent.length === 1);
	assert.deepEqual(box.spoken, ["Merged AR0081."], "only the reply that answers a voice note is spoken");
	assert.deepEqual(box.sent, [{ files: ["/home/speak/14.ogg"] }]);
	assert.deepEqual(box.replies(), [
		{ text: "Typed only.", answers: [typed.seq], channels: ["test"] },
		{ text: "Read the docs.", answers: [wake.seq], channels: [] },
		{ text: "Media only.", answers: [media.seq], channels: ["test"] },
		{ text: "Merged AR0081.", answers: [typed.seq, spoken.seq], channels: ["test"] },
	], `nothing for the voice note ${unanswered.seq} the replies do not answer, on telegram, which has no channel.send`);
});

test("voice notes from two places and two channels that one reply answers: spoken once, sent once by each channel, in the order of the replies; a broken message it answers is skipped", async (t) => {
	const box = await setup(async (text) => `/home/speak/${text}.ogg`);
	t.mock.method(console, "error", () => {});
	const broken = box.fake.emit("message-received", { channel: "test", parts: [] });
	const [one, two, other] = [box.say("test", [VOICE], "12"), box.say("test", [VOICE]), box.say("telegram", [VOICE])];
	await box.reply("First", [broken, one, two, other], ["test", "telegram"]);
	const later = box.say("test", [VOICE], "12");
	await box.reply("Second", [later], ["test"]);
	await until("two sends", () => box.sent.length === 2);
	assert.deepEqual(box.spoken, ["First", "Second"]);
	assert.deepEqual(box.sent, [{ files: ["/home/speak/First.ogg"] }, { files: ["/home/speak/Second.ogg"] }]);
	assert.deepEqual(box.replies(), [
		{ text: "First", answers: [broken.seq, one.seq, two.seq, other.seq], channels: ["test", "telegram"] },
		{ text: "Second", answers: [later.seq], channels: ["test"] },
		{ text: "voice note not sent: telegram provides no channel.send", answers: [other.seq], channels: ["telegram"] },
	], "the line goes to that channel alone, once its voice note is made");
});

test("one reply's voice note at a time: the next is not spoken while the one before is still being sent, and they go in the order of the replies", async () => {
	const upload = Promise.withResolvers<void>();
	const started: string[] = [];
	const box = await setup(
		async (text) => `/home/speak/${text}.ogg`,
		(message) => () => (started.push(message.files[0] ?? ""), message.files[0]?.includes("First") ? upload.promise.then(() => "sent") : Promise.resolve("sent")),
	);
	await box.reply("First", [box.say("test", [VOICE])], ["test"]);
	await until("the first upload", () => started.length === 1);
	await box.reply("Second", [box.say("test", [VOICE])], ["test"]);
	assert.deepEqual(box.spoken, ["First"], "the second reply waits for the first one's send");
	upload.resolve();
	await until("both sent", () => box.sent.length === 2);
	assert.deepEqual([box.spoken, started, box.sent], [["First", "Second"], ["/home/speak/First.ogg", "/home/speak/Second.ogg"], [{ files: ["/home/speak/First.ogg"] }, { files: ["/home/speak/Second.ogg"] }]]);
});

test("a voice note that cannot be made or sent: the text went, and one line on that channel says why", async () => {
	const cases: readonly [Speak, Send | undefined, string][] = [
		[async () => Promise.reject(new Error("the text has 1600 characters, over maxChars 1500")), undefined, "the text has 1600 characters, over maxChars 1500"],
		[() => Promise.reject(new Error("piper: timed out after 120 s")), undefined, "piper: timed out after 120 s"],
		[() => {
			throw new Error("piper not found on PATH; see arthur doctor");
		}, undefined, "piper not found on PATH; see arthur doctor"],
		[async () => "/home/speak/a.ogg", () => {
			throw new Error("/home/speak/a.ogg: no such file\nsecond line");
		}, "/home/speak/a.ogg: no such file; second line"],
		[async () => "/home/speak/a.ogg", () => () => Promise.reject(new Error("telegram bot (unnamed): sendVoice: 400: Bad Request; nothing went")), "telegram bot (unnamed): sendVoice: 400: Bad Request; nothing went"],
		[async () => "/home/speak/a.ogg", () => "no send" as never, "test: channel.send answered no send"],
	];
	for (const [speak, send, why] of cases) {
		const box = await setup(speak, send);
		const note = box.say("test", [VOICE], "12");
		await box.reply("Done.", [note], ["test"]);
		await until(`the line: ${why}`, () => box.replies().length === 2);
		assert.deepEqual(box.replies(), [
			{ text: "Done.", answers: [note.seq], channels: ["test"] },
			{ text: `voice note not sent: ${why}`, answers: [note.seq], channels: ["test"] },
		]);
		assert.deepEqual(box.sent, []);
	}
});

test("a channel without channel.send gets the line; with no plugin providing speak.say the text goes alone and nothing is said", async () => {
	const box = await setup(async () => "/home/speak/a.ogg");
	const note = box.say("telegram", [VOICE]);
	await box.reply("Done.", [note], ["telegram"]);
	await until("the line", () => box.replies().length === 2);
	assert.deepEqual(box.replies()[1], { text: "voice note not sent: telegram provides no channel.send", answers: [note.seq], channels: ["telegram"] });
	assert.deepEqual(box.sent, [], "another channel's send is not asked");
	const alone = await setup(null);
	const [first, second] = [alone.say("test", [VOICE]), alone.say("test", [VOICE])];
	await alone.reply("Done.", [first], ["test"]);
	await alone.reply("Again.", [second], ["test"]);
	await until("both replies", () => alone.replies().length === 2);
	// The voice step of each reply is only promises, all settled before the next turn of the event loop.
	await new Promise(setImmediate);
	assert.deepEqual(alone.replies(), [
		{ text: "Done.", answers: [first.seq], channels: ["test"] },
		{ text: "Again.", answers: [second.seq], channels: ["test"] },
	]);
	assert.deepEqual(alone.sent, []);
});

test("while the inbox runs, its sweep every 500 ms sends the voice note of a reply as it emits it; a claim's reply is not spoken", async (t) => {
	const fake = fakeHost({ name: "orchestration" });
	const [spoken, sent]: [string[], unknown[]] = [[], []];
	fake.provide("speak.say", async (text: string) => (spoken.push(text), `/home/speak/${text}ogg`));
	fake.provide("channel.send", (message: unknown) => async () => (sent.push(message), "sent 1 file in 1 message"));
	const box = inbox(fake.host);
	box.start();
	t.after(() => box.stop());
	const note = fake.emit("message-received", { channel: "test", parts: [VOICE] });
	mkdirSync(join(fake.host.folder, "outbox"), { recursive: true });
	writeFileSync(join(fake.host.folder, "outbox", `${Date.now()}-000001.json`), JSON.stringify({ text: "Started.", answers: [`${note.seq}-${Date.parse(note.time)}`], channels: ["test"] }));
	await until("the voice note", () => sent.length === 1);
	assert.deepEqual(sent, [{ files: ["/home/speak/Started.ogg"] }]);
	assert.deepEqual(spoken, ["Started."]);
	assert.deepEqual(fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => event.data), [
		{ text: NOT_TRANSCRIBED, answers: [note.seq], channels: ["test"] },
		{ text: "Started.", answers: [note.seq], channels: ["test"] },
	]);
});

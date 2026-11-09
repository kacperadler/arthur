import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHost, temporaryFolder, until } from "@arthur/core/testing";
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
	await box.reply("Typed only.", [typed], ["test"]);
	const spoken = box.say("test", [TEXT, VOICE], "12");
	await box.reply("Merged AR0081.", [typed, spoken], ["test"]);
	await until("the voice note", () => box.sent.length === 1);
	assert.deepEqual(box.spoken, ["Merged AR0081."], "only the reply that answers a voice note is spoken");
	assert.deepEqual(box.sent, [{ files: ["/home/speak/14.ogg"] }]);
	assert.deepEqual(box.replies(), [
		{ text: "Typed only.", answers: [typed.seq], channels: ["test"] },
		{ text: "Merged AR0081.", answers: [typed.seq, spoken.seq], channels: ["test"] },
	]);
});

test("voice notes from two places and two channels that one reply answers: spoken once, sent once by each channel, in the order of the replies", async () => {
	const box = await setup(async (text) => `/home/speak/${text}.ogg`);
	const [one, two, other] = [box.say("test", [VOICE], "12"), box.say("test", [VOICE]), box.say("telegram", [VOICE])];
	await box.reply("First", [one, two, other], ["test", "telegram"]);
	const later = box.say("test", [VOICE], "12");
	await box.reply("Second", [later], ["test"]);
	await until("two sends", () => box.sent.length === 2);
	assert.deepEqual(box.spoken, ["First", "Second"]);
	assert.deepEqual(box.sent, [{ files: ["/home/speak/First.ogg"] }, { files: ["/home/speak/Second.ogg"] }]);
	assert.deepEqual(box.replies(), [
		{ text: "First", answers: [one.seq, two.seq, other.seq], channels: ["test", "telegram"] },
		{ text: "Second", answers: [later.seq], channels: ["test"] },
		{ text: "voice note not sent: telegram provides no channel.send", answers: [other.seq], channels: ["telegram"] },
	], "the line goes to that channel alone, once its voice note is made");
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

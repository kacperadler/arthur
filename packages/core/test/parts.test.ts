import assert from "node:assert/strict";
import { test } from "node:test";
import { NOT_TRANSCRIBED, received, turnText } from "../src/message-parts.ts";
import { fakeHost } from "../src/testing.ts";

const text = (said: string) => ({ kind: "text", text: said, mime: "text/plain" }) as const;
const photo = { kind: "photo", path: "/home/arthur/.arthur/telegram/media/AQAD.jpg", mime: "image/jpeg" } as const;
const voice = { kind: "voice", path: "/home/arthur/.arthur/telegram/media/AwAD.oga", mime: "audio/ogg", seconds: 4 } as const;

// A host whose `message.part` providers are `claims`, in setup order, and the events it emitted.
function host(...claims: ((part: unknown) => unknown)[]) {
	const fake = fakeHost({ name: "orchestration" });
	for (const claim of claims) fake.provide("message.part", claim);
	const replies = () => fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => event.data);
	return { host: fake.host, replies };
}

test("a message is a channel and at least one part, each of a known kind with its mime, a text part's text or another's path", () => {
	const good = { channel: "telegram", parts: [photo, text("What is it?"), voice], place: "12", instance: "second" };
	assert.equal(received(good), good);
	const wrong = "expected { kind: text | photo | video | voice | audio | file, mime, text (a text part) or path (any other), seconds? }";
	for (const [data, problem] of [
		[null, "expected channel, non-empty text, got nothing"],
		[{ channel: " ", parts: [text("Hi.")] }, 'expected channel, non-empty text, got " "'],
		[{ channel: "telegram", text: "Hi." }, "expected parts, a list of at least one part, got nothing"],
		[{ channel: "telegram", parts: [] }, "expected parts, a list of at least one part, got an empty list"],
		[{ channel: "telegram", parts: [text("Hi."), { ...photo, kind: "sticker" }] }, `parts[1]: ${wrong}`],
		[{ channel: "telegram", parts: [{ ...photo, mime: "" }] }, `parts[0]: ${wrong}`],
		[{ channel: "telegram", parts: [{ kind: "photo", mime: "image/jpeg", text: "no path" }] }, `parts[0]: ${wrong}`],
		[{ channel: "telegram", parts: [{ kind: "text", mime: "text/plain", path: "/no/text" }] }, `parts[0]: ${wrong}`],
		[{ channel: "telegram", parts: [{ ...voice, seconds: -1 }] }, `parts[0]: ${wrong}`],
		[{ channel: "telegram", parts: [text("Hi.")], place: 12 }, "expected place, non-empty text when given, got 12"],
		[{ channel: "telegram", parts: [text("Hi.")], instance: "" }, 'expected instance, non-empty text when given, got ""'],
	] as const)
		assert.equal(received(data), problem, JSON.stringify(data));
});

test("the turn is each part's text in order: a text as written, an unclaimed media part as its saved path, with its mime and length", async () => {
	const { host: on, replies } = host(() => undefined);
	const video = { kind: "video", path: "/m/v.mp4", mime: "video/mp4", seconds: 12 } as const;
	assert.equal(await turnText(on, 7, { channel: "telegram", parts: [photo, video, text("What is it?")] }), [`[photo, image/jpeg] (${photo.path})`, "[video, video/mp4, 12 s] (/m/v.mp4)", "What is it?"].join("\n"));
	assert.deepEqual(replies(), [], "nothing goes back to the human");
});

test("the first claim in setup order replaces the part by its text; its reply goes back to the channel and place the message came from", async () => {
	const asked: unknown[] = [];
	const { host: on, replies } = host(
		(part) => void asked.push(part),
		async (part) => (part === voice ? { text: "[voice 4 s] Start AR0081.", reply: "heard: Start AR0081." } : undefined),
		() => ({ text: "second claim" }),
	);
	assert.equal(await turnText(on, 9, { channel: "telegram", parts: [voice, text("And merge it.")], place: "12" }), "[voice 4 s] Start AR0081.\nAnd merge it.");
	assert.deepEqual(asked, [voice], "a text part is asked of no plugin");
	assert.deepEqual(replies(), [{ text: "heard: Start AR0081.", answers: [9], channels: ["telegram"], place: "12" }]);
});

test("an unclaimed voice note is one line to the coordinator and the same line to the human", async () => {
	const { host: on, replies } = host();
	assert.equal(await turnText(on, 3, { channel: "telegram", parts: [voice] }), NOT_TRANSCRIBED);
	assert.equal(NOT_TRANSCRIBED, "[voice note not transcribed: the voice plugin is not enabled]");
	assert.deepEqual(replies(), [{ text: NOT_TRANSCRIBED, answers: [3], channels: ["telegram"] }]);
});

test("a claim that throws or rejects leaves the part as its saved path, with the plugin and its error in one line; a later claim still wins", async () => {
	const saved = `[voice, audio/ogg, 4 s] (${voice.path})`;
	const throws = host(() => {
		throw new Error("whisper-cli\nexited 1");
	});
	assert.equal(await turnText(throws.host, 1, { channel: "telegram", parts: [voice] }), `${saved}; test failed: whisper-cli exited 1`);
	assert.deepEqual(throws.replies(), [], "a failed claim is not the missing plugin's line");
	const rejects = host(() => Promise.reject(new Error("timed out")), () => "not a claim");
	assert.equal(await turnText(rejects.host, 1, { channel: "telegram", parts: [voice] }), `${saved}; test failed: timed out; test failed: it answered "not a claim", not { text, reply? }`);
	const recovered = host(() => Promise.reject(new Error("timed out")), () => ({ text: "claimed" }));
	assert.equal(await turnText(recovered.host, 1, { channel: "telegram", parts: [voice] }), "claimed");
});

test("a claim won before a later plugin's rejects leaves no unhandled rejection", async (t) => {
	const unhandled: unknown[] = [];
	const note = (reason: unknown) => void unhandled.push(reason);
	process.on("unhandledRejection", note);
	t.after(() => process.off("unhandledRejection", note));
	const late = Promise.withResolvers<never>();
	const { host: on } = host(() => ({ text: "first" }), () => late.promise);
	assert.equal(await turnText(on, 1, { channel: "telegram", parts: [photo] }), "first");
	late.reject(new Error("late"));
	// Node reports an unhandled rejection once the microtasks after it are drained, before the next macrotask.
	await new Promise(setImmediate);
	assert.deepEqual(unhandled, []);
});

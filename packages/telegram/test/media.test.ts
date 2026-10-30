import assert from "node:assert/strict";
import { readFileSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder, until } from "@arthur/core/testing";
import { botApi, CHAT, load, said, TOKEN } from "./fake-bot-api.ts";

const MB = 1024 * 1024;

// Each File field as the Bot API's documentation shows it; `id` is its file_id, `unique` its file_unique_id.
const sizes = (id: string, unique: string) => [
	{ file_id: `${id}-small`, file_unique_id: `${unique}-small`, file_size: 1200, width: 90, height: 68 },
	{ file_id: id, file_unique_id: unique, file_size: 64000, width: 1280, height: 960 },
	{ file_id: `${id}-medium`, file_unique_id: `${unique}-medium`, file_size: 21000, width: 320, height: 240 },
];
const video = (id: string, unique: string) => ({ file_id: id, file_unique_id: unique, width: 1920, height: 1080, duration: 12, thumbnail: { file_id: "t", file_unique_id: "t", file_size: 900, width: 320, height: 180 }, file_name: "clip.mp4", mime_type: "video/mp4", file_size: 4000 });

test("each kind of media is a part with its saved path, mime and length; a caption is a text part after its file; a sender's file name stays in the folder", async (t) => {
	const api = await botApi(t);
	const { plugin, received, folder } = await load(t, { apiUrl: api.url });
	const files = { photo: "photos/file_1.jpg", video: "videos/file_2.mp4", note: "video_notes/file_3.mp4", voice: "voice/file_4.oga", audio: "music/file_5.mp3", doc: "documents/file_6" };
	for (const [id, path] of Object.entries(files)) api.file(id, path, Buffer.from(`bytes of ${id}`));
	await plugin.start?.();
	api.push({ text: undefined, photo: sizes("photo", "AQADphoto"), caption: "The board." });
	api.push({ text: undefined, video: video("video", "BAADvideo") });
	api.push({ text: undefined, video_note: { file_id: "note", file_unique_id: "DQADnote", length: 240, duration: 7, file_size: 3000 } });
	api.push({ text: undefined, voice: { file_id: "voice", file_unique_id: "AwADvoice", duration: 4, mime_type: "audio/ogg", file_size: 2000 } });
	api.push({ text: undefined, audio: { file_id: "audio", file_unique_id: "CQADaudio", duration: 180, performer: "Band", title: "Song", file_name: "song.mp3", mime_type: "audio/mpeg", file_size: 5000 } });
	api.push({ text: undefined, document: { file_id: "doc", file_unique_id: "BQADdoc", file_name: "..\\..\\.bashrc", mime_type: "text/plain", file_size: 200 } });
	await until("six messages", () => received().length === 6);
	const media = (name: string) => join(folder, "media", name);
	assert.deepEqual(received(), [
		{ channel: "telegram", parts: [{ kind: "photo", path: media("AQADphoto.jpg"), mime: "image/jpeg" }, ...said("The board.")] },
		{ channel: "telegram", parts: [{ kind: "video", path: media("BAADvideo-clip.mp4"), mime: "video/mp4", seconds: 12 }] },
		{ channel: "telegram", parts: [{ kind: "video", path: media("DQADnote.mp4"), mime: "video/mp4", seconds: 7 }] },
		{ channel: "telegram", parts: [{ kind: "voice", path: media("AwADvoice.oga"), mime: "audio/ogg", seconds: 4 }] },
		{ channel: "telegram", parts: [{ kind: "audio", path: media("CQADaudio-song.mp3"), mime: "audio/mpeg", seconds: 180 }] },
		{ channel: "telegram", parts: [{ kind: "file", path: media("BQADdoc-bashrc"), mime: "text/plain" }] },
	]);
	assert.equal(readFileSync(media("AQADphoto.jpg"), "utf8"), "bytes of photo", "the largest size, whatever its place in the list");
	assert.equal(readFileSync(media("BQADdoc-bashrc"), "utf8"), "bytes of doc");
	assert.deepEqual(api.sent(), [], "no line back");
});

test("an album of photos and a video with a caption, over two polls, is one message, its parts in order; a text after it waits for it", async (t) => {
	const api = await botApi(t);
	const { plugin, received, folder } = await load(t, { apiUrl: api.url });
	for (const id of ["one", "two", "clip"]) api.file(id, `album/${id}`, Buffer.from(id));
	await plugin.start?.();
	api.pushAll([
		{ text: undefined, media_group_id: "13", photo: sizes("one", "AQADone"), caption: "Before and after.", message_thread_id: 12, is_topic_message: true },
		{ text: undefined, media_group_id: "13", photo: sizes("two", "AQADtwo"), message_thread_id: 12, is_topic_message: true },
	]);
	await until("a poll of 1 s for the rest of the album", () => api.polls().some((poll) => poll.timeout === 1));
	api.pushAll([{ text: undefined, media_group_id: "13", video: video("clip", "BAADclip"), message_thread_id: 12, is_topic_message: true }, { text: "Merge it." }]);
	await until("two messages", () => received().length === 2);
	assert.deepEqual(received(), [
		{
			channel: "telegram",
			parts: [
				{ kind: "photo", path: join(folder, "media", "AQADone"), mime: "image/jpeg" },
				{ kind: "photo", path: join(folder, "media", "AQADtwo"), mime: "image/jpeg" },
				{ kind: "video", path: join(folder, "media", "BAADclip-clip.mp4"), mime: "video/mp4", seconds: 12 },
				...said("Before and after."),
			],
			place: "12",
		},
		{ channel: "telegram", parts: said("Merge it.") },
	]);
});

test("an album of one is one message; a file over 20 MB or one Telegram will not hand over is a text part saying why, never the token", async (t) => {
	const api = await botApi(t);
	const { plugin, received, folder } = await load(t, { apiUrl: api.url });
	api.file("one", "photos/one.jpg", Buffer.from("one"));
	api.file("exact", "documents/exact", Buffer.from("20 MB as Telegram counts it"));
	await plugin.start?.();
	api.push({ text: undefined, media_group_id: "14", photo: sizes("one", "AQADone") });
	await until("the album of one", () => received().length === 1);
	api.fail("getFile", 400, `Bad Request: wrong file_id for bot${TOKEN}`);
	api.push({ text: undefined, voice: { file_id: "gone", file_unique_id: "AwADgone", duration: 3, mime_type: "audio/ogg", file_size: 900 } });
	api.push({ text: undefined, document: { file_id: "huge", file_unique_id: "BQADhuge", file_name: "dump.tar", mime_type: "application/x-tar", file_size: 20 * MB + 1 } });
	api.push({ text: undefined, document: { file_id: "exact", file_unique_id: "BQADexact", file_name: "dump.tar", mime_type: "application/x-tar", file_size: 20 * MB } });
	await until("four messages", () => received().length === 4);
	assert.deepEqual(received(), [
		{ channel: "telegram", parts: [{ kind: "photo", path: join(folder, "media", "AQADone.jpg"), mime: "image/jpeg" }] },
		{ channel: "telegram", parts: said("[voice not saved: telegram bot (unnamed): getFile: 400: Bad Request: wrong file_id for bot[token]]") },
		{ channel: "telegram", parts: said("[file not saved: 20971521 bytes is over the 20971520 (20 MB) a bot may download]") },
		{ channel: "telegram", parts: [{ kind: "file", path: join(folder, "media", "BQADexact-dump.tar"), mime: "application/x-tar" }] },
	]);
	assert.ok(!api.calls.some((call) => call.method === "getFile" && call.params.file_id === "huge"), "a file over the limit is not asked for");
});

// A PNG's or a JPEG's first bytes with the size Telegram judges a photo by.
const png = (width: number, height: number) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.from([width >> 24, width >> 16, width >> 8, width].map((byte) => byte & 0xff)), Buffer.from([height >> 24, height >> 16, height >> 8, height].map((byte) => byte & 0xff)), Buffer.alloc(9)]);
const jpeg = (width: number, height: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, ...Array(12).fill(0)]);

// The files in a new folder, by name; `path(name)` is where one is.
function files(contents: Readonly<Record<string, Buffer | string>>): (name: string) => string {
	const folder = temporaryFolder();
	for (const [name, bytes] of Object.entries(contents)) writeFileSync(join(folder, name), bytes);
	return (name) => join(folder, name);
}

const upload = (path: string) => ({ name: path.split("/").at(-1), bytes: readFileSync(path) });

test("channel.send: photos and videos as one album with the caption, then the other files as documents, to the topic", async (t) => {
	const api = await botApi(t);
	const { fake } = await load(t, { apiUrl: api.url });
	const path = files({ "a.png": png(800, 600), "b.mp4": "mp4 bytes", "c.pdf": "a report", "d.JPG": jpeg(1200, 900), "e.txt": "a log" });
	const [answer] = fake.host.collectEach<() => Promise<string>>("channel.send", { files: ["a.png", "b.mp4", "c.pdf", "d.JPG", "e.txt"].map(path), caption: "Screens.", place: "12" });
	assert.ok(answer !== undefined && "value" in answer);
	assert.equal(await answer.value(), "sent 5 files in 2 messages");
	const to = { chat_id: String(CHAT), message_thread_id: "12", disable_notification: "false" };
	assert.deepEqual(api.media(), [
		{
			method: "sendMediaGroup",
			...to,
			file0: upload(path("a.png")),
			file1: upload(path("b.mp4")),
			file2: upload(path("d.JPG")),
			media: JSON.stringify([{ type: "photo", media: "attach://file0", caption: "Screens." }, { type: "video", media: "attach://file1" }, { type: "photo", media: "attach://file2" }]),
		},
		{ method: "sendMediaGroup", ...to, file0: upload(path("c.pdf")), file1: upload(path("e.txt")), media: JSON.stringify([{ type: "document", media: "attach://file0" }, { type: "document", media: "attach://file1" }]) },
	]);
});

test("channel.send: an album of one goes as itself, a photo over 10 MB as a document; a place not a topic goes to the chat; quiet hours, no notification", async (t) => {
	const api = await botApi(t);
	const { fake } = await load(t, { apiUrl: api.url });
	fake.setNow(new Date("2026-10-19T21:30:00Z"));
	const path = files({ "one.png": png(100, 100), "big.png": png(4000, 3000) });
	truncateSync(path("big.png"), 10 * MB + 1);
	const send = async (message: unknown) => {
		const [answer] = fake.host.collectEach<() => Promise<string>>("channel.send", message);
		assert.ok(answer !== undefined && "value" in answer, JSON.stringify(answer));
		return answer.value();
	};
	assert.equal(await send({ files: [path("one.png")], caption: "Alone.", place: "general" }), "sent 1 file in 1 message");
	assert.equal(await send({ files: [path("big.png"), path("one.png")] }), "sent 2 files in 2 messages");
	assert.deepEqual(api.media(), [
		{ method: "sendPhoto", chat_id: String(CHAT), disable_notification: "true", photo: upload(path("one.png")), caption: "Alone." },
		{ method: "sendPhoto", chat_id: String(CHAT), disable_notification: "true", photo: upload(path("one.png")) },
		{ method: "sendDocument", chat_id: String(CHAT), disable_notification: "true", document: upload(path("big.png")) },
	]);
});

test("channel.send refuses before any send: 11 files, a file over 50 MB, a photo past Telegram's sides, an empty or missing file, a long caption", async (t) => {
	const api = await botApi(t);
	const { fake } = await load(t, { apiUrl: api.url });
	const path = files({ "huge.bin": "", "wide.png": png(9000, 1001), "tall.jpg": jpeg(100, 2001), "empty.txt": "", "square.png": png(5000, 5000), "edge.jpg": jpeg(100, 2000), "max.bin": "" });
	truncateSync(path("huge.bin"), 50 * MB + 1);
	truncateSync(path("max.bin"), 50 * MB);
	const refusal = (message: unknown) => {
		const [answer] = fake.host.collectEach("channel.send", message);
		return answer !== undefined && "error" in answer ? answer.error.message : `no refusal: ${typeof answer?.value}`;
	};
	const all = ["huge.bin", "wide.png", "tall.jpg", "empty.txt", "gone.png", "square.png", "edge.jpg", "max.bin", "square.png", "square.png", "square.png"].map(path);
	const sides = "Telegram takes a photo whose width plus height is at most 10000 px and whose sides differ by at most 20 to 1; slice it into viewport-high images (for example 1600 px tall) and send them as one album";
	assert.equal(
		refusal({ files: all, caption: "c".repeat(1025) }),
		[
			"11 files; Telegram takes at most 10 in one album",
			"the caption has 1025 characters; Telegram takes at most 1024",
			`${path("huge.bin")}: 52428801 bytes; Telegram takes at most 52428800 (50 MB) from a bot`,
			`${path("wide.png")}: 9000x1001 px; ${sides}`,
			`${path("tall.jpg")}: 100x2001 px; ${sides}`,
			`${path("empty.txt")}: empty; Telegram takes no empty file`,
			`${path("gone.png")}: no such file`,
		].join("\n"),
	);
	assert.equal(refusal({ files: all.slice(1), caption: "c".repeat(1024) }).split("\n")[0], `${path("wide.png")}: 9000x1001 px; ${sides}`, "10 files and 1024 characters are within the limits");
	assert.equal(refusal({ files: ["square.png", "edge.jpg", "max.bin"].map(path) }), "no refusal: function", "10000 px together, 20 to 1 and 50 MB exactly are within them too");
	assert.equal(refusal({ files: [] }), "expected files, a list of at least one path");
	assert.equal(refusal({ files: [path("square.png")], caption: 5 }), "expected caption as text");
	assert.ok(!api.calls.some((call) => call.method.startsWith("send")), "nothing was sent");
});

test("channel.send: a refused message names the method and what went before it, never the token", async (t) => {
	const api = await botApi(t);
	const { fake } = await load(t, { apiUrl: api.url });
	const path = files({ "photo.png": png(100, 100), "notes.txt": "notes" });
	const send = (message: unknown) => {
		const [answer] = fake.host.collectEach<() => Promise<string>>("channel.send", message);
		return answer !== undefined && "value" in answer ? answer.value().then(String, (error: Error) => error.message) : "refused";
	};
	api.fail("sendDocument", 413, `Request Entity Too Large for bot${TOKEN}`);
	assert.equal(await send({ files: [path("photo.png"), path("notes.txt")] }), "telegram bot (unnamed): sendDocument: 413: Request Entity Too Large for bot[token]; 1 of 2 messages went before it");
	api.fail("sendPhoto", 400, "Bad Request: chat not found");
	assert.equal(await send({ files: [path("photo.png")] }), "telegram bot (unnamed): sendPhoto: 400: Bad Request: chat not found; nothing went");
	assert.deepEqual(api.media().map((sent) => sent.method), ["sendPhoto"]);
});

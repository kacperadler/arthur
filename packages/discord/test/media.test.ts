import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { type TestContext, test } from "node:test";
import { temporaryFolder, until } from "@arthur/core/testing";
import { FOREIGN, fakeDiscord, load, MAIN, PROJECT, TOKEN } from "./fake-discord.ts";

// Files both ways on Discord (spec/roadmap.md, entry 90): what the owner sends saved as parts, and `channel.send`.

const MIB = 1024 * 1024;
const text = (said: string) => ({ kind: "text", text: said, mime: "text/plain" });

async function started(t: TestContext) {
	const api = await fakeDiscord(t);
	const loaded = await load(t, { apiUrl: api.url });
	await loaded.plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	return { api, ...loaded };
}

test("each file is saved as <id>-<name> and becomes a part by its kind, the files before the text; the CDN gets no token", async (t) => {
	const { api, received, folder } = await started(t);
	const media = join(folder, "media");
	api.message({ content: " Look. ", attachments: [api.attach("1800000000000000001", "a.png", "png", { content_type: "image/png", width: 1, height: 1 }), api.attach("1800000000000000002", "b.mp4", "mp4", { content_type: "video/mp4" })] });
	api.message({ content: "", flags: 8192, attachments: [api.attach("1800000000000000003", "voice-message.ogg", "ogg", { content_type: "audio/ogg", duration_secs: 3.52, waveform: "AAAA" })] });
	api.message({ content: "", attachments: [api.attach("1800000000000000004", "song.mp3", "mp3", { content_type: "audio/mpeg" }), api.attach("1800000000000000005", "notes.pdf", "pdf", { content_type: "application/pdf" })] });
	api.message({ content: "", attachments: [api.attach("1800000000000000006", "../../.ssh/key\u0007s", "raw"), api.attach("1800000000000000007", "", "nameless", { content_type: "" })] });
	await until("four messages", () => received().length === 4);
	assert.deepEqual(received(), [
		{ channel: "discord", parts: [{ kind: "photo", path: join(media, "1800000000000000001-a.png"), mime: "image/png" }, { kind: "video", path: join(media, "1800000000000000002-b.mp4"), mime: "video/mp4" }, text("Look.")] },
		{ channel: "discord", parts: [{ kind: "voice", path: join(media, "1800000000000000003-voice-message.ogg"), mime: "audio/ogg", seconds: 3.52 }] },
		{ channel: "discord", parts: [{ kind: "audio", path: join(media, "1800000000000000004-song.mp3"), mime: "audio/mpeg" }, { kind: "file", path: join(media, "1800000000000000005-notes.pdf"), mime: "application/pdf" }] },
		{ channel: "discord", parts: [{ kind: "file", path: join(media, "1800000000000000006-keys"), mime: "application/octet-stream" }, { kind: "file", path: join(media, "1800000000000000007"), mime: "application/octet-stream" }] },
	]);
	assert.deepEqual(readdirSync(media).map((name) => readFileSync(join(media, name), "utf8")), ["png", "mp4", "ogg", "mp3", "pdf", "raw", "nameless"]);
	const downloads = api.calls.filter((call) => call.path.startsWith("/attachments/"));
	assert.equal(downloads.length, 7);
	assert.ok(downloads.every((call) => call.headers.authorization === undefined && !JSON.stringify(call).includes(TOKEN)), "a CDN link is signed: no token goes with it");
	assert.deepEqual(api.took, [], "a message with files gets no line back");
});

test("a download that fails is a text part saying why, in the file's place; the rest of the message still goes", async (t) => {
	const { api, received } = await started(t);
	const gone = { ...api.attach("1800000000000000011", "gone.png", "x", { content_type: "image/png" }), url: `${api.url}/attachments/${MAIN}/1/gone.png` };
	const { url: _, ...linkless } = api.attach("1800000000000000012", "linkless.txt", "x");
	// A port that was just let go, where nothing listens.
	const closed = createServer().listen(0, "127.0.0.1");
	await once(closed, "listening");
	const port = (closed.address() as AddressInfo).port;
	closed.close();
	await once(closed, "close");
	const unreachable = { ...api.attach("1800000000000000013", "far.ogg", "x", { content_type: "audio/ogg" }), url: `http://127.0.0.1:${port}/attachments/far.ogg` };
	api.message({ content: "Three files.", flags: 8192, attachments: [gone, linkless, unreachable] });
	await until("the message", () => received().length === 1);
	assert.deepEqual(received(), [
		{
			channel: "discord",
			parts: [
				text("[voice gone.png not saved: Discord's CDN answered 404]"),
				text("[voice linkless.txt not saved: Discord gave no url]"),
				text("[voice far.ogg not saved: fetch failed (ECONNREFUSED)]"),
				text("Three files."),
			],
		},
	]);
});

test("a forward's files come with the mark; a stop during a download drops the message unheard, so the next start reads it again", async (t) => {
	const { api, received, plugin, folder } = await started(t);
	const reference = { type: 1, channel_id: "1700000000000000001", message_id: "1700000000000000002" };
	const snapshot = { message: { type: 0, content: "", embeds: [], timestamp: "2026-10-31T09:00:00.000000+00:00", edited_timestamp: null, flags: 0, mentions: [], mention_roles: [], attachments: [api.attach("1800000000000000021", "f.png", "f", { content_type: "image/png" })] } };
	api.message({ content: "", message_reference: reference, message_snapshots: [snapshot] });
	await until("the forward", () => received().length === 1);
	assert.deepEqual(received()[0], { channel: "discord", parts: [{ kind: "photo", path: join(folder, "media", "1800000000000000021-f.png"), mime: "image/png" }, text("[forwarded from a hidden sender]")] });
	const held = api.message({ content: "Held.", attachments: [api.attach("1800000000000000022", "slow.png", null)] });
	await until("the download begun", () => existsSync(join(folder, "media", "1800000000000000022-slow.png.tmp")));
	await plugin.stop?.();
	assert.equal(received().length, 1, "a stop waits for the message in hand, which it drops");
	assert.ok(!readFileSync(join(folder, "seen.json"), "utf8").includes(held.id), "the message is not heard");
	assert.deepEqual(readdirSync(join(folder, "media")), ["1800000000000000021-f.png"], "nothing half written stays");
	api.attach("1800000000000000022", "slow.png", "slow", { content_type: "image/png" });
	api.history = [held];
	const again = await load(t, { apiUrl: api.url }, { folder });
	await again.plugin.start?.();
	await until("read again", () => again.received().length === 1);
	assert.deepEqual(again.received(), [{ channel: "discord", parts: [{ kind: "file", path: join(folder, "media", "1800000000000000022-slow.png"), mime: "application/octet-stream" }, text("Held.")] }]);
});

// `arthur send` loads the plugin without starting it, so the sends below go without a gateway.
test("send: files in one multipart request, payload_json and files[n], the caption pinging no one; quiet hours suppress the notification", async (t) => {
	const api = await fakeDiscord(t);
	const { fake } = await load(t, { apiUrl: api.url });
	const dir = temporaryFolder();
	const files = ["a.png", "b.txt", "c.pdf"].map((name) => join(dir, name));
	for (const file of files) writeFileSync(file, `bytes of ${file}`);
	const send = fake.call<() => Promise<string>>("channel.send", { files, caption: "The pages." });
	assert.deepEqual(api.took, [], "nothing goes before the send is called");
	assert.equal(await send(), "sent 3 files in 1 message");
	fake.setNow(new Date("2026-10-31T23:00:00Z"));
	assert.equal(await fake.call<() => Promise<string>>("channel.send", { files: files.slice(0, 1) })(), "sent 1 file in 1 message");
	const attachments = (names: string[]) => names.map((filename, id) => ({ id, filename }));
	assert.deepEqual(api.took, [
		{ channel: MAIN, body: { content: "The pages.", allowed_mentions: { parse: [] }, flags: 0, attachments: attachments(["a.png", "b.txt", "c.pdf"]) }, files: files.map((file, at) => ({ field: `files[${at}]`, filename: ["a.png", "b.txt", "c.pdf"][at] ?? "", text: `bytes of ${file}` })) },
		{ channel: MAIN, body: { allowed_mentions: { parse: [] }, flags: 4096, attachments: attachments(["a.png"]) }, files: [{ field: "files[0]", filename: "a.png", text: `bytes of ${files[0]}` }] },
	]);
	assert.equal(api.calls.filter((call) => call.method === "POST").length, 2, "one request per send");
});

test("send: a place that is a text channel of the server is where the files go; any other place, the main channel", async (t) => {
	const api = await fakeDiscord(t);
	const { fake } = await load(t, { apiUrl: api.url });
	const file = join(temporaryFolder(), "a.txt");
	writeFileSync(file, "a");
	for (const place of [PROJECT, FOREIGN, "1300000000000000099", "12abc", MAIN]) await fake.call<() => Promise<string>>("channel.send", { files: [file], place })();
	assert.deepEqual(api.took.map((each) => each.channel), [PROJECT, MAIN, MAIN, MAIN, MAIN]);
	assert.deepEqual(api.calls.filter((call) => call.method === "GET" && call.path.startsWith("/channels/")).map((call) => call.path), [`/channels/${PROJECT}`, `/channels/${FOREIGN}`, "/channels/1300000000000000099"], "a place that is no id, or the main channel, is not asked");
	api.fail(`GET /channels/${PROJECT}`, 502, { message: "Bad Gateway", code: 0 });
	await assert.rejects(fake.call<() => Promise<string>>("channel.send", { files: [file], place: PROJECT })(), /GET \/channels\/1300000000000000004: 502: Bad Gateway/);
	assert.equal(api.took.length, 5, "a place Discord could not say goes nowhere, not to the main channel");
});

test("send: every refusal at once, before anything goes: over 10 files, a file over 20 MiB, over 25 MiB in all, a missing or empty file, a long caption", async (t) => {
	const api = await fakeDiscord(t);
	const { fake } = await load(t, { apiUrl: api.url });
	const dir = temporaryFolder();
	const sized = (name: string, bytes: number) => {
		const path = join(dir, name);
		writeFileSync(path, "");
		truncateSync(path, bytes);
		return path;
	};
	const send = (message: unknown) => fake.call<() => Promise<string>>("channel.send", message);
	const refusals: string[] = [];
	const refusal = (message: unknown) => assert.throws(() => send(message), (error: Error) => (refusals.push(error.message), true));
	const [big, max, half, small, empty, folder] = [sized("big", 20 * MIB + 1), sized("max", 20 * MIB), sized("half", 12.5 * MIB), sized("small", 1), sized("empty", 0), join(dir, "folder")];
	mkdirSync(folder);
	refusal({ files: Array(11).fill(small), caption: "x".repeat(2001) });
	refusal({ files: [big, join(dir, "missing"), empty, folder] });
	refusal({ files: [half, half], caption: "x" });
	refusal({ files: [] });
	refusal({ files: [small], caption: 7 });
	assert.deepEqual(refusals, [
		"11 files; Discord takes at most 10 in one message\nthe caption has 2001 characters; Discord takes at most 2000",
		`${big}: 20971521 bytes; Discord takes at most 20971520 (20 MiB) in one file\n${join(dir, "missing")}: no such file\n${empty}: empty; Discord takes no empty file\n${folder}: no such file`,
		"26214401 bytes in all; Discord takes at most 26214400 (25 MiB) in one message",
		"expected files, a list of at least one path",
		"expected caption as text",
	]);
	for (const message of [{ files: Array(10).fill(small), caption: "x".repeat(2000) }, { files: [max] }, { files: [half, half] }]) assert.equal(typeof send(message), "function", "at each limit");
	assert.deepEqual(api.calls, [], "nothing asked of Discord");
});

test("send: a message Discord refuses fails the send with its line, never the token", async (t) => {
	const api = await fakeDiscord(t);
	const { fake } = await load(t, { apiUrl: api.url });
	const file = join(temporaryFolder(), "a.txt");
	writeFileSync(file, "a");
	api.fail(`POST /channels/${MAIN}/messages`, 403, { message: `Missing Permissions ${TOKEN}`, code: 50013 });
	await assert.rejects(fake.call<() => Promise<string>>("channel.send", { files: [file] })(), (error: Error) => error.message === "discord bot (unnamed): POST /channels/1300000000000000003/messages: 403: Missing Permissions [token]");
});

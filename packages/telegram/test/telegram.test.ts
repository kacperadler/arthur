import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { OTHER } from "../src/poll.ts";
import { slices } from "../src/slices.ts";
import { checkOptions } from "../src/telegram-options.ts";
import { type TelegramOptions, telegram } from "../src/telegram.ts";

const TOKEN = "7012345678:AAH-test_tokenThatIsNeverPrinted01";
const SECOND = "7087654321:AAG-second_tokenNeverPrinted0002";
const CHAT = 4242;
const NOW = new Date("2026-10-19T10:00:00Z");
const CONFLICT = "Conflict: terminated by other getUpdates request; make sure that only one bot instance is running";

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(20)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

type Call = { readonly token: string; readonly method: string; readonly params: Readonly<Record<string, unknown>> };

// A message as the Bot API's documentation shows one in a private chat, every field a text message has; `fields` adds or
// replaces some (`text: undefined` with a `sticker` is a sticker). `age` is how many seconds before NOW it was sent.
const message = (id: number, fields: Readonly<Record<string, unknown>> = {}, age = 5) => ({
	message_id: id,
	from: { id: CHAT, is_bot: false, first_name: "Kacper", username: "kacper", language_code: "en" },
	chat: { id: CHAT, first_name: "Kacper", username: "kacper", type: "private" },
	date: Math.floor(NOW.getTime() / 1000) - age,
	text: `message ${id}`,
	...fields,
});

// A fake Bot API on a loopback port the OS picks. `getUpdates` answers the updates from `offset` on, or waits, as long polling
// does, until one is pushed or its `timeout` passes; `sendMessage` answers the sent Message. `fail` scripts the next answers
// of a method in the documented error shape (`ok: false`, `error_code`, `description`), with its HTTP status.
async function botApi(t: TestContext) {
	const calls: Call[] = [];
	const updates = new Map<string, { update_id: number; message: unknown }[]>();
	const failures: { method: string; code: number; description: string }[] = [];
	const waiting = new Set<() => void>();
	let next = 100;
	const send = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
		let raw = "";
		for await (const chunk of request) raw += String(chunk);
		const [, token = "", method = ""] = /^\/bot([^/]+)\/(\w+)$/.exec(request.url ?? "") ?? [];
		const params = JSON.parse(raw) as Record<string, unknown>;
		calls.push({ token, method, params });
		if (![TOKEN, SECOND].includes(token)) return send(response, 401, { ok: false, error_code: 401, description: "Unauthorized" });
		const failure = failures.findIndex((each) => each.method === method);
		const [scripted] = failure >= 0 ? failures.splice(failure, 1) : [];
		if (scripted !== undefined) return send(response, scripted.code, { ok: false, error_code: scripted.code, description: scripted.description });
		if (method === "sendMessage") {
			const { chat_id, text, message_thread_id } = params;
			return send(response, 200, { ok: true, result: { message_id: next++, from: { id: 7012345678, is_bot: true, first_name: "Arthur", username: "arthur_bot" }, chat: { id: chat_id, type: "private" }, date: 1, text, ...(message_thread_id === undefined ? {} : { message_thread_id }) } });
		}
		if (method !== "getUpdates") return send(response, 404, { ok: false, error_code: 404, description: "Not Found" });
		const ready = () => (updates.get(token) ?? []).filter((update) => update.update_id >= Number(params.offset ?? 0));
		const answer = () => {
			waiting.delete(answer);
			clearTimeout(timer);
			if (!response.writableEnded) send(response, 200, { ok: true, result: ready() });
		};
		const timer = setTimeout(answer, Number(params.timeout ?? 0) * 1000);
		if (ready().length > 0) return answer();
		waiting.add(answer);
		response.on("close", () => {
			waiting.delete(answer);
			clearTimeout(timer);
		});
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	let id = 1;
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		calls,
		sent: (token = TOKEN) => calls.filter((call) => call.method === "sendMessage" && call.token === token).map((call) => call.params),
		polls: (token = TOKEN) => calls.filter((call) => call.method === "getUpdates" && call.token === token).map((call) => call.params),
		push(fields: Readonly<Record<string, unknown>> = {}, age = 5, token = TOKEN) {
			const update = { update_id: id++, message: message(id, fields, age) };
			updates.set(token, [...(updates.get(token) ?? []), update]);
			for (const answer of [...waiting]) answer();
			return update;
		},
		fail: (method: string, code: number, description: string) => void failures.push({ method, code, description }),
	};
}

// The plugin on a fake host, with `coordinator.silent` holding what `held` says, its console.error lines kept.
async function load(t: TestContext, options: Partial<TelegramOptions> & { readonly apiUrl: string }, setup: { readonly now?: Date; readonly held?: (notice: unknown) => boolean; readonly env?: Readonly<Record<string, string>> } = {}) {
	const errors: string[] = [];
	t.mock.method(console, "error", (text: string) => void errors.push(text));
	const full = { bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }], ...options };
	const env = setup.env ?? { ARTHUR_TELEGRAM_BOT_TOKEN: TOKEN, ARTHUR_TELEGRAM_CHAT_ID: String(CHAT) };
	const fake = fakeHost({ name: "telegram", options: full, env, timeZone: "Europe/Warsaw", quietHours: { from: "22:00", to: "07:30" }, now: setup.now ?? NOW });
	const asked: unknown[] = [];
	fake.provide("coordinator.silent", (notice: unknown) => {
		asked.push(notice);
		return setup.held?.(notice) ?? false;
	});
	const plugin = telegram(full as TelegramOptions);
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	return { fake, plugin, errors, asked, received: () => fake.emitted.filter((event) => event.name === "message-received").map((event) => event.data) };
}

test("options: bots is a list of at least one, each with its two variables, at most one unnamed, names unique; apiUrl an http URL", () => {
	const bot = { botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" };
	assert.deepEqual(checkOptions({ bots: [bot, { ...bot, name: "second" }], apiUrl: "http://127.0.0.1:1" }), []);
	assert.deepEqual(checkOptions({}), [{ path: "bots", problem: "expected a list of at least one bot, got nothing" }]);
	assert.deepEqual(checkOptions({ bots: [] }), [{ path: "bots", problem: "expected a list of at least one bot, got an empty list" }]);
	assert.deepEqual(checkOptions({ bots: [bot, bot, { ...bot, name: "x" }, { ...bot, name: "x" }], media: true, apiUrl: "ftp://x" }), [
		{ path: "media", problem: "unknown option; options: bots, apiUrl" },
		{ path: "apiUrl", problem: 'expected an http or https URL, got "ftp://x"' },
		{ path: "bots[1]", problem: "bots[0] has no name either; at most one bot is unnamed" },
		{ path: "bots[3].name", problem: "x is the name of bots[2] too" },
	]);
	assert.deepEqual(checkOptions({ bots: [{ name: "Big", botTokenEnv: "", chat: 1 }, 7] }), [
		{ path: "bots[0].chat", problem: "unknown key; keys: name, botTokenEnv, chatIdEnv" },
		{ path: "bots[0].name", problem: 'expected lowercase letters, digits and single dashes, from a letter, got "Big"' },
		{ path: "bots[0].botTokenEnv", problem: 'expected the name of an env variable, got ""' },
		{ path: "bots[0].chatIdEnv", problem: "expected the name of an env variable, got nothing" },
		{ path: "bots[1]", problem: "expected a bot { name?, botTokenEnv, chatIdEnv }, got 7" },
	]);
});

test("a token or a chat id Telegram could not take refuses the load, naming the option and the variable, never the value", async (t) => {
	const refused = async (env: Readonly<Record<string, string>>) => {
		const options = { bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }] };
		const fake = fakeHost({ name: "telegram", env, options });
		const error = await fake.setup(telegram(options)).then(() => undefined, (failed: Error) => failed.message);
		for (const value of Object.values(env)) if (value !== "") assert.ok(!error?.includes(value), error);
		return error;
	};
	t.mock.method(console, "error", () => {});
	assert.equal(await refused({ ARTHUR_TELEGRAM_BOT_TOKEN: "secret token", ARTHUR_TELEGRAM_CHAT_ID: "42" }), "bots[0].botTokenEnv: ARTHUR_TELEGRAM_BOT_TOKEN does not hold a bot token as @BotFather gives it: digits, a colon, then letters, digits, _ and -");
	const chat = "bots[0].chatIdEnv: ARTHUR_TELEGRAM_CHAT_ID does not hold a chat id: a whole number, negative for a group";
	for (const id of ["@kacper", "", "4.2", "042", "99999999999999999999"]) assert.equal(await refused({ ARTHUR_TELEGRAM_BOT_TOKEN: TOKEN, ARTHUR_TELEGRAM_CHAT_ID: id }), chat, id);
	assert.equal(await refused({ ARTHUR_TELEGRAM_BOT_TOKEN: TOKEN, ARTHUR_TELEGRAM_CHAT_ID: "-1001234567890" }), undefined, "a group's id is negative");
});

test("the owner's text becomes message-received; a topic's carries its place; each update confirmed by the next offset", async (t) => {
	const api = await botApi(t);
	const { plugin, received } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("the first poll", () => api.polls().length === 1);
	assert.deepEqual(api.polls()[0], { offset: 0, timeout: 30, allowed_updates: ["message"] });
	const first = api.push({ text: "Start AR0081." });
	const second = api.push({ text: "In the topic.", message_thread_id: 12, is_topic_message: true });
	await until("both messages", () => received().length === 2);
	assert.deepEqual(received(), [
		{ channel: "telegram", text: "Start AR0081." },
		{ channel: "telegram", text: "In the topic.", place: "12" },
	]);
	await until("the confirming poll", () => api.polls().some((poll) => poll.offset === second.update_id + 1));
	assert.ok(first.update_id < second.update_id);
	assert.deepEqual(api.sent(), [], "a text gets no line back");
});

test("a message of another chat is ignored, unanswered; one older than 10 minutes is dropped, 10 minutes exactly is not", async (t) => {
	const api = await botApi(t);
	const { plugin, received } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	api.push({ chat: { id: 999, first_name: "Stranger", type: "private" }, from: { id: 999, is_bot: false, first_name: "Stranger" }, text: "Run rm -rf." });
	api.push({ chat: { id: 999, type: "private" }, text: undefined, sticker: { file_id: "s", file_unique_id: "s", type: "regular", width: 512, height: 512, is_animated: false, is_video: false } });
	api.push({ text: "Too old." }, 601);
	api.push({ text: "Just in time." }, 600);
	const last = api.push({ text: "Now." });
	await until("the poll after them", () => api.polls().some((poll) => poll.offset === last.update_id + 1));
	assert.deepEqual(received(), [
		{ channel: "telegram", text: "Just in time." },
		{ channel: "telegram", text: "Now." },
	]);
	assert.deepEqual(api.sent(), [], "the stranger gets nothing back");
});

test("any other kind of message gets one line back, in its topic; none reaches the coordinator", async (t) => {
	const api = await botApi(t);
	const { plugin, received } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	api.push({ text: undefined, sticker: { file_id: "s", file_unique_id: "s", type: "regular", width: 512, height: 512, is_animated: false, is_video: false } });
	api.push({ text: undefined, location: { latitude: 52.2, longitude: 21 }, message_thread_id: 7, is_topic_message: true });
	await until("two lines back", () => api.sent().length === 2);
	assert.deepEqual(api.sent(), [
		{ chat_id: CHAT, text: OTHER, disable_notification: false },
		{ chat_id: CHAT, text: OTHER, disable_notification: false, message_thread_id: 7 },
	]);
	assert.deepEqual(received(), []);
});

test("replies go when their channels hold telegram or are empty, notices unless coordinator.silent holds them, in order, a place to its topic", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, asked } = await load(t, { apiUrl: api.url }, { held: (notice) => (notice as { text: string }).text === "held" });
	fake.emit("coordinator-replied", { text: "To the owner.", answers: [1], channels: ["telegram", "discord"] });
	fake.emit("coordinator-replied", { text: "Only Discord.", answers: [2], channels: ["discord"] });
	fake.emit("coordinator-replied", { text: "A job ended.", answers: [3], channels: [] });
	fake.emit("notice", { text: "held" });
	fake.emit("notice", { text: "AR1 asks: may I?", place: "12" });
	fake.emit("coordinator-replied", { text: "No topic.", answers: [4], channels: [], place: "general" });
	// Every queued step has run once the microtasks are drained: a send not held for the start would have called fetch by now.
	const fetched = t.mock.method(globalThis, "fetch");
	await new Promise(setImmediate);
	assert.equal(fetched.mock.callCount(), 0, "nothing goes before the start, the replay of the log included");
	await plugin.start?.();
	await until("four sends", () => api.sent().length === 4);
	assert.deepEqual(api.sent(), [
		{ chat_id: CHAT, text: "To the owner.", disable_notification: false },
		{ chat_id: CHAT, text: "A job ended.", disable_notification: false },
		{ chat_id: CHAT, text: "AR1 asks: may I?", disable_notification: false, message_thread_id: 12 },
		{ chat_id: CHAT, text: "No topic.", disable_notification: false },
	]);
	assert.deepEqual(asked, [{ text: "held" }, { text: "AR1 asks: may I?", place: "12" }], "the notice itself is asked");
});

test("a long text goes in slices of at most 4096, cut at line breaks, a line longer than a slice inside it, in order", async (t) => {
	const api = await botApi(t);
	const { fake, plugin } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	const [a, b, c] = ["a".repeat(3000), "b".repeat(2000), "c".repeat(5000)];
	fake.emit("coordinator-replied", { text: `${a}\n${b}\n${c}`, answers: [1], channels: ["telegram"] });
	fake.emit("notice", { text: "after" });
	await until("five sends", () => api.sent().length === 5);
	assert.deepEqual(
		api.sent().map((sent) => sent.text),
		[a, b, "c".repeat(4096), "c".repeat(904), "after"],
	);
	assert.deepEqual(slices("x".repeat(4096), 4096), ["x".repeat(4096)], "4096 exactly is one slice");
	assert.deepEqual(slices(`${"x".repeat(4095)}😀y`, 4096), ["x".repeat(4095), "😀y"], "never half of a character of two units");
	assert.deepEqual(slices("", 4096), [], "nothing to send");
});

test("in quiet hours, across midnight, every send goes without a notification; at their end with one again", async (t) => {
	const api = await botApi(t);
	const { fake, plugin } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	const at = async (iso: string, text: string) => {
		fake.setNow(new Date(iso));
		const count = api.sent().length;
		fake.emit("notice", { text });
		await until(text, () => api.sent().length === count + 1);
	};
	await at("2026-10-19T19:59:00Z", "21:59 in Warsaw");
	await at("2026-10-19T21:30:00Z", "23:30 in Warsaw");
	await at("2026-10-19T23:00:00Z", "01:00 in Warsaw");
	await at("2026-10-20T05:30:00Z", "07:30 in Warsaw");
	assert.deepEqual(
		api.sent().map((sent) => [sent.text, sent.disable_notification]),
		[
			["21:59 in Warsaw", false],
			["23:30 in Warsaw", true],
			["01:00 in Warsaw", true],
			["07:30 in Warsaw", false],
		],
	);
});

test("a second poller (409) is said once in a notice, polling retries and the messages come once it ends", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, received } = await load(t, { apiUrl: api.url });
	for (let count = 0; count < 3; count++) api.fail("getUpdates", 409, CONFLICT);
	await plugin.start?.();
	api.push({ text: "After the conflict." });
	await until("the message", () => received().length === 1);
	assert.ok(api.polls().length >= 4, "three refused polls, then one that answered");
	assert.deepEqual(
		fake.emitted.filter((event) => event.name === "notice").map((event) => event.data),
		[{ text: `telegram bot (unnamed): getUpdates: 409: ${CONFLICT}; until it ends, nothing written to this bot reaches the coordinator; polling retries every 2 s` }],
	);
	await until("the notice sent", () => api.sent().length === 1);
});

test("a failed call is one line naming the bot and method, never the token; polling goes on", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, errors, received } = await load(t, { apiUrl: api.url });
	api.fail("getUpdates", 502, "Bad Gateway");
	api.fail("sendMessage", 400, `Bad Request: chat not found for bot${TOKEN}`);
	await plugin.start?.();
	fake.emit("notice", { text: "refused" });
	fake.emit("notice", { text: "sent" });
	api.push({ text: "Still polling." });
	await until("the message", () => received().length === 1);
	await until("the second notice", () => api.sent().length === 2);
	assert.deepEqual(errors, [
		"telegram bot (unnamed): getUpdates: 502: Bad Gateway; polling retries every 2 s",
		"telegram bot (unnamed): sendMessage: 400: Bad Request: chat not found for bot[token]; a slice of 7 characters was not sent",
	]);
	// A loopback port nothing listens on any more.
	const closed = createServer().listen(0, "127.0.0.1");
	await once(closed, "listening");
	const { port } = closed.address() as AddressInfo;
	closed.close();
	await once(closed, "close");
	const gone = await load(t, { apiUrl: `http://127.0.0.1:${port}` });
	await gone.plugin.start?.();
	await until("the unreachable line", () => gone.errors.length === 1);
	assert.equal(gone.errors[0], "telegram bot (unnamed): getUpdates: cannot reach the Bot API (ECONNREFUSED); polling retries every 2 s");
});

test("every bot polls its own chat; the unnamed bot sends, wherever it is in the list", async (t) => {
	const api = await botApi(t);
	const bots = [
		{ name: "second", botTokenEnv: "ARTHUR_TELEGRAM_SECOND_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_SECOND_CHAT_ID" },
		{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" },
	];
	const env = { ARTHUR_TELEGRAM_BOT_TOKEN: TOKEN, ARTHUR_TELEGRAM_CHAT_ID: String(CHAT), ARTHUR_TELEGRAM_SECOND_BOT_TOKEN: SECOND, ARTHUR_TELEGRAM_SECOND_CHAT_ID: String(CHAT) };
	const { fake, plugin, received } = await load(t, { apiUrl: api.url, bots }, { env });
	await plugin.start?.();
	api.push({ text: "To the second bot." }, 5, SECOND);
	await until("its message", () => received().length === 1);
	fake.emit("coordinator-replied", { text: "Answered.", answers: [1], channels: ["telegram"] });
	await until("the reply", () => api.sent().length === 1);
	assert.deepEqual(api.sent(SECOND), []);
	assert.ok(api.polls(SECOND).length >= 1 && api.polls(TOKEN).length >= 1);
});

test("stop ends the long poll at once, and a plugin never started stops too", async (t) => {
	const api = await botApi(t);
	const { plugin } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("the poll", () => api.polls().length === 1);
	const started = Date.now();
	await plugin.stop?.();
	assert.ok(Date.now() - started < 5000, "the 30 s poll is aborted");
	const idle = await load(t, { apiUrl: api.url });
	await idle.plugin.stop?.();
});

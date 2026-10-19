import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { everyOption, type OptionTable } from "@arthur/core/option-table";
import { fakeHost } from "@arthur/core/testing";
import { OTHER } from "../src/poll.ts";
import { cut, slices } from "../src/slices.ts";
import { checkOptions, table } from "../src/telegram-options.ts";
import { API_URL, type TelegramOptions, telegram } from "../src/telegram.ts";

// Built at run time, so no literal in the repository looks like a bot token to a secret scanner; Telegram answers both 401.
const TOKEN = ["7012345678", `AAH-${"t".repeat(31)}`].join(":");
const SECOND = ["7087654321", `AAG-${"s".repeat(31)}`].join(":");
const CHAT = 4242;
const NOW = new Date("2026-10-19T10:00:00Z");
const CONFLICT = "Conflict: terminated by other getUpdates request; make sure that only one bot instance is running";

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(20)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// The address of a loopback port nothing listens on any more: the Bot API unreachable.
async function nowhere(): Promise<string> {
	const closed = createServer().listen(0, "127.0.0.1");
	await once(closed, "listening");
	const { port } = closed.address() as AddressInfo;
	closed.close();
	await once(closed, "close");
	return `http://127.0.0.1:${port}`;
}

type Call = { readonly token: string; readonly method: string; readonly params: Readonly<Record<string, unknown>>; readonly at: number };

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
// of a method in the documented error shape (`ok: false`, `error_code`, `description`), with its HTTP status. `sent` is every
// sendMessage call, `took` those it answered with a Message.
async function botApi(t: TestContext) {
	const calls: Call[] = [];
	const taken: Call[] = [];
	const updates = new Map<string, { update_id: number; message: unknown }[]>();
	const failures: { method: string; code: number; description: string; parameters?: { retry_after: number } }[] = [];
	const waiting = new Set<() => void>();
	let next = 100;
	const send = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
		let raw = "";
		for await (const chunk of request) raw += String(chunk);
		const [, token = "", method = ""] = /^\/bot([^/]+)\/(\w+)$/.exec(request.url ?? "") ?? [];
		const params = JSON.parse(raw) as Record<string, unknown>;
		calls.push({ token, method, params, at: Date.now() });
		if (![TOKEN, SECOND].includes(token)) return send(response, 401, { ok: false, error_code: 401, description: "Unauthorized" });
		const failure = failures.findIndex((each) => each.method === method);
		const [scripted] = failure >= 0 ? failures.splice(failure, 1) : [];
		if (scripted !== undefined) {
			const { code, description, parameters } = scripted;
			return send(response, code, { ok: false, error_code: code, description, ...(parameters === undefined ? {} : { parameters }) });
		}
		if (method === "sendMessage") {
			const { chat_id, text, message_thread_id } = params;
			taken.push({ token, method, params, at: Date.now() });
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
		took: (token = TOKEN) => taken.filter((call) => call.token === token).map((call) => call.params),
		polls: (token = TOKEN) => calls.filter((call) => call.method === "getUpdates" && call.token === token).map((call) => call.params),
		push(fields: Readonly<Record<string, unknown>> = {}, age = 5, token = TOKEN) {
			const update = { update_id: id++, message: message(id, fields, age) };
			updates.set(token, [...(updates.get(token) ?? []), update]);
			for (const answer of [...waiting]) answer();
			return update;
		},
		fail: (method: string, code: number, description: string, parameters?: { retry_after: number }) => void failures.push({ method, code, description, parameters }),
	};
}

// The plugin on a fake host, with `coordinator.silent` holding what `held` says, its console.error lines kept; `folder` stands for
// the plugin's folder, so a second load shares the first one's outbox, as a restart or a second process does.
async function load(t: TestContext, options: Partial<TelegramOptions> & { readonly apiUrl: string }, setup: { readonly now?: Date; readonly held?: (notice: unknown) => boolean; readonly env?: Readonly<Record<string, string>>; readonly folder?: string } = {}) {
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
	const folder = setup.folder ?? fake.host.folder;
	await (setup.folder === undefined ? fake.setup(plugin) : plugin.setup({ ...fake.host, folder }));
	t.after(() => plugin.stop?.());
	const queued = (box = "") => (existsSync(join(folder, "outbox", box)) ? readdirSync(join(folder, "outbox", box)).filter((name) => name.endsWith(".json")) : []);
	return { fake, plugin, errors, asked, folder, queued, received: () => fake.emitted.filter((event) => event.name === "message-received").map((event) => event.data) };
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
	api.push({ text: "In the topic.", message_thread_id: 12, is_topic_message: true });
	const second = api.push({ text: "A reply, no topic.", message_thread_id: 40, reply_to_message: message(1) });
	await until("all three messages", () => received().length === 3);
	assert.deepEqual(received(), [
		{ channel: "telegram", text: "Start AR0081." },
		{ channel: "telegram", text: "In the topic.", place: "12" },
		{ channel: "telegram", text: "A reply, no topic." },
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
	const { fake, plugin, asked, queued } = await load(t, { apiUrl: api.url }, { held: (notice) => (notice as { text: string }).text === "held" });
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
	assert.deepEqual(queued(), [], "nor is queued: a command that loads the plugin and never starts it writes no outbox");
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

test("a failed poll is one line naming the bot and method, never the token; polling goes on", async (t) => {
	const api = await botApi(t);
	const { plugin, errors, received } = await load(t, { apiUrl: api.url });
	api.fail("getUpdates", 502, "Bad Gateway");
	await plugin.start?.();
	api.push({ text: "Still polling." });
	await until("the message", () => received().length === 1);
	assert.deepEqual(errors, ["telegram bot (unnamed): getUpdates: 502: Bad Gateway; polling retries in 2 s"]);
	const gone = await load(t, { apiUrl: await nowhere() });
	await gone.plugin.start?.();
	await until("the unreachable line", () => gone.errors.length === 1);
	assert.equal(gone.errors[0], "telegram bot (unnamed): getUpdates: cannot reach the Bot API (ECONNREFUSED); polling retries in 2 s");
});

test("a 429 while polling waits the seconds Telegram says, and says so once", async (t) => {
	const api = await botApi(t);
	const { plugin, errors, received } = await load(t, { apiUrl: api.url });
	api.fail("getUpdates", 429, "Too Many Requests: retry after 3", { retry_after: 3 });
	await plugin.start?.();
	api.push({ text: "After the wait." });
	await until("the message", () => received().length === 1);
	const [refused, next] = api.polls().length >= 2 ? api.calls.filter((call) => call.method === "getUpdates") : [];
	assert.ok(next !== undefined && refused !== undefined && next.at - refused.at >= 3000, `${next?.at} - ${refused?.at}`);
	assert.deepEqual(errors, ["telegram bot (unnamed): getUpdates: 429: Too Many Requests: retry after 3; polling retries in 3 s"]);
});

test("every bot polls its own chat; a reply goes by each bot the messages it answers came through, the rest by the unnamed one", async (t) => {
	const api = await botApi(t);
	const bots = [
		{ name: "second", botTokenEnv: "ARTHUR_TELEGRAM_SECOND_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_SECOND_CHAT_ID" },
		{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" },
	];
	const env = { ARTHUR_TELEGRAM_BOT_TOKEN: TOKEN, ARTHUR_TELEGRAM_CHAT_ID: String(CHAT), ARTHUR_TELEGRAM_SECOND_BOT_TOKEN: SECOND, ARTHUR_TELEGRAM_SECOND_CHAT_ID: String(CHAT) };
	const { fake, plugin, received } = await load(t, { apiUrl: api.url, bots }, { env });
	await plugin.start?.();
	api.push({ text: "To the second bot." }, 5, SECOND);
	api.push({ text: "To the unnamed bot." }, 5, TOKEN);
	await until("both messages", () => received().length === 2);
	const seq = (text: string) => fake.emitted.find((event) => event.name === "message-received" && (event.data as { text: string }).text === text)?.seq;
	const [second, unnamed] = [seq("To the second bot."), seq("To the unnamed bot.")];
	assert.deepEqual(new Set(received()), new Set([{ channel: "telegram", text: "To the second bot.", instance: "second" }, { channel: "telegram", text: "To the unnamed bot." }]));
	fake.emit("coordinator-replied", { text: "To the second.", answers: [second], channels: ["telegram"] });
	fake.emit("coordinator-replied", { text: "To the unnamed.", answers: [unnamed], channels: ["telegram"] });
	fake.emit("coordinator-replied", { text: "To both.", answers: [unnamed, second], channels: ["telegram"] });
	fake.emit("coordinator-replied", { text: "A job ended.", answers: [], channels: [] });
	fake.emit("coordinator-replied", { text: "Answers no message of the log.", answers: [10_000], channels: ["telegram"] });
	fake.emit("notice", { text: "A notice." });
	await until("the sends", () => api.took(SECOND).length === 2 && api.took(TOKEN).length === 5);
	assert.deepEqual(
		api.took(SECOND).map((sent) => sent.text),
		["To the second.", "To both."],
	);
	assert.deepEqual(
		api.took(TOKEN).map((sent) => sent.text),
		["To the unnamed.", "To both.", "A job ended.", "Answers no message of the log.", "A notice."],
	);
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

const sends = (calls: readonly Call[]) => calls.filter((call) => call.method === "sendMessage");

test("one retry per send, after 2 s; a slice failing twice waits with the ones after it and goes first next time, said once", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, errors, queued, folder } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	api.fail("sendMessage", 502, "Bad Gateway");
	fake.emit("notice", { text: "once" });
	await until("the retry", () => api.took().length === 1);
	const [failed, retried] = sends(api.calls);
	assert.ok(failed !== undefined && retried !== undefined && retried.at - failed.at >= 2000, "the retry waits 2 s");
	assert.deepEqual(errors, [], "a send the retry took is said nowhere");
	for (let count = 0; count < 4; count++) api.fail("sendMessage", 502, "Bad Gateway");
	const [a, b] = ["a".repeat(3000), "b".repeat(2000)];
	fake.emit("coordinator-replied", { text: `${a}\n${b}`, answers: [1], channels: [] });
	await until("the failure said", () => errors.length === 1);
	assert.equal(errors[0], `telegram bot (unnamed): sendMessage: 502: Bad Gateway; the slice waits in ${join(folder, "outbox")} and goes first next time`);
	assert.equal(queued().length, 2, "the reply's second slice waits behind its first");
	fake.emit("notice", { text: "next" });
	await until("the next time, failed again", () => sends(api.calls).length === 6);
	fake.emit("notice", { text: "last" });
	await until("all of them", () => api.took().length === 5);
	assert.deepEqual(
		api.took().map((sent) => sent.text),
		["once", a, b, "next", "last"],
	);
	assert.equal(errors.length, 1, "the same failure is said once until a slice goes");
	assert.deepEqual(queued(), []);
});

test("Telegram unreachable: the slices wait in the outbox through a restart, then go first, in order, a topic's to its topic", async (t) => {
	const api = await botApi(t);
	const down = await load(t, { apiUrl: await nowhere() });
	await down.plugin.start?.();
	down.fake.emit("notice", { text: "AR1 asks: may I?", place: "12" });
	down.fake.emit("notice", { text: "After it." });
	await until("the failure said", () => down.errors.some((line) => line.includes("sendMessage")));
	await down.plugin.stop?.();
	assert.equal(down.queued().length, 2);
	assert.ok(down.errors.includes(`telegram bot (unnamed): sendMessage: cannot reach the Bot API (ECONNREFUSED); the slice waits in ${join(down.folder, "outbox")} and goes first next time`));
	const back = await load(t, { apiUrl: api.url }, { folder: down.folder });
	await back.plugin.start?.();
	await until("both sent", () => api.took().length === 2);
	assert.deepEqual(api.took(), [
		{ chat_id: CHAT, text: "AR1 asks: may I?", disable_notification: false, message_thread_id: 12 },
		{ chat_id: CHAT, text: "After it.", disable_notification: false },
	]);
	await until("the outbox empty", () => back.queued().length === 0);
});

test("Telegram back while nothing new is sent: an answered poll sends what waits", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, errors, queued } = await load(t, { apiUrl: api.url });
	for (let count = 0; count < 2; count++) api.fail("sendMessage", 502, "Bad Gateway");
	api.fail("getUpdates", 502, "Bad Gateway");
	await plugin.start?.();
	fake.emit("notice", { text: "Waited." });
	await until("the failure said", () => errors.some((line) => line.includes("sendMessage")));
	api.push({ text: "A poll answers." });
	await until("the waiting slice sent", () => api.took().length === 1);
	assert.deepEqual(queued(), []);
});

test("a 429 on a send waits the seconds Telegram says before the retry; a stop during that wait keeps the slice queued", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, queued } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	api.fail("sendMessage", 429, "Too Many Requests: retry after 3", { retry_after: 3 });
	fake.emit("notice", { text: "After the wait." });
	await until("the retry", () => api.took().length === 1);
	const [limited, retried] = sends(api.calls);
	assert.ok(limited !== undefined && retried !== undefined && retried.at - limited.at >= 3000, `${retried?.at} - ${limited?.at}`);
	api.fail("sendMessage", 429, "Too Many Requests: retry after 60", { retry_after: 60 });
	fake.emit("notice", { text: "Held back." });
	await until("the second 429", () => sends(api.calls).length === 3);
	const stopping = Date.now();
	await plugin.stop?.();
	assert.ok(Date.now() - stopping < 5000, "the stop cuts the 60 s wait short");
	assert.equal(queued().length, 1, "the slice waits for the next start");
});

test("a refused (4xx) slice is set aside and told once until a slice goes, never blocking the ones after it; the told text cut to one message", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, errors, queued, folder } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	const blocked = `Forbidden: bot was blocked by the user bot${TOKEN}`;
	for (let count = 0; count < 3; count++) api.fail("sendMessage", 403, blocked);
	const long = Array.from({ length: 40 }, (_, line) => String(line).padEnd(99, "r")).join("\n");
	fake.emit("notice", { text: long });
	fake.emit("notice", { text: "Refused too." });
	// The told notice is refused third: it is not told again.
	await until("three set aside", () => queued("refused").length === 3);
	assert.equal(sends(api.calls).length, 3, "a refused slice is not retried");
	fake.emit("notice", { text: "Goes." });
	await until("it goes", () => api.took().length === 1);
	api.fail("sendMessage", 400, "Bad Request: message thread not found");
	fake.emit("notice", { text: "To a topic gone.", place: "77" });
	await until("the second told notice", () => api.took().length === 2);
	const [first, second] = queued("refused").sort();
	const told = fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text);
	const aside = join(folder, "outbox", "refused", first ?? "");
	const note = `\n… cut; whole in ${aside}`;
	assert.equal(told.length, 2, "told once, then once more after a slice went");
	assert.equal(told[0]?.slice(0, told[0].indexOf("rrr")), `telegram bot (unnamed): sendMessage: 403: Forbidden: bot was blocked by the user bot[token]; this slice was set aside in ${aside}:\n0`);
	assert.ok(told[0]?.endsWith(note) && told[0].length <= 4096 && told[0].length > 4096 - 120, `cut to one message with the note, at a line: ${told[0]?.length}`);
	assert.equal(JSON.parse(readFileSync(aside, "utf8")).text, long, "the whole slice kept");
	assert.equal(told[1], `telegram bot (unnamed): sendMessage: 400: Bad Request: message thread not found; this slice was set aside in ${join(folder, "outbox", "refused", queued("refused").sort()[3] ?? "")}:\nTo a topic gone.`);
	assert.deepEqual(api.took()[1], { chat_id: CHAT, text: told[1], disable_notification: false }, "the told notice goes to the chat itself");
	assert.equal(errors.length, 4, "each set aside is one line");
	assert.equal(errors[1], `telegram bot (unnamed): sendMessage: 403: Forbidden: bot was blocked by the user bot[token]; the slice is set aside in ${join(folder, "outbox", "refused", second ?? "")}`);
	assert.ok(errors.every((line) => !line.includes(TOKEN)));
	assert.deepEqual(queued(), []);
});

test("a file in the outbox that is no slice, broken or edited by hand, is set aside with a line; one of a bot gone goes by the unnamed one", async (t) => {
	const api = await botApi(t);
	const { plugin, errors, queued, folder } = await load(t, { apiUrl: api.url });
	mkdirSync(join(folder, "outbox"));
	writeFileSync(join(folder, "outbox", "1-broken.json"), "{ not json");
	writeFileSync(join(folder, "outbox", "2-edited.json"), JSON.stringify({ bot: null, text: "Edited.", place: "general" }));
	writeFileSync(join(folder, "outbox", "3-gone.json"), JSON.stringify({ bot: "gone", text: "A bot no longer in the config.", place: "7" }));
	await plugin.start?.();
	await until("the good one", () => api.took().length === 1);
	assert.deepEqual(api.took(), [{ chat_id: CHAT, text: "A bot no longer in the config.", disable_notification: false, message_thread_id: 7 }]);
	assert.deepEqual(queued("refused").sort(), ["1-broken.json", "2-edited.json"]);
	assert.deepEqual(errors, [
		`telegram: ${join(folder, "outbox", "1-broken.json")} is not a slice { bot, text, place? }; the slice is set aside in ${join(folder, "outbox", "refused", "1-broken.json")}`,
		`telegram: ${join(folder, "outbox", "2-edited.json")} is not a slice { bot, text, place? }; the slice is set aside in ${join(folder, "outbox", "refused", "2-edited.json")}`,
	]);
	assert.deepEqual(cut("x".repeat(4096), 4096, "\n… cut"), "x".repeat(4096), "4096 exactly is not cut");
	assert.deepEqual(cut(`${"x".repeat(4000)}\n${"y".repeat(100)}`, 4096, "\n… cut"), `${"x".repeat(4000)}\n… cut`);
});

// A second process, as `arthur run` is: the plugin on a host of its own sharing the parent's plugin folder, which sends 20
// notices once the parent writes to its stdin, then stops.
const CHILD = `
import { fakeHost } from "@arthur/core/testing";
import { telegram } from ${JSON.stringify(new URL("../src/telegram.ts", import.meta.url).href)};
const options = { bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }], apiUrl: process.env.API };
const env = { ARTHUR_TELEGRAM_BOT_TOKEN: process.env.BOT_TOKEN, ARTHUR_TELEGRAM_CHAT_ID: process.env.CHAT_ID };
const fake = fakeHost({ name: "telegram", options, env });
fake.provide("coordinator.silent", () => false);
const plugin = telegram(options);
await plugin.setup({ ...fake.host, folder: process.env.FOLDER });
await plugin.start();
process.stdout.write("ready\\n");
for await (const _ of process.stdin) break;
for (let i = 0; i < 20; i++) fake.emit("notice", { text: "child " + i });
await plugin.stop();
`;

test("two processes sending at once through one outbox: each one's slices go in its order, each once", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, folder, queued } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	// The kit clears every ARTHUR_ variable at its import, so the child gets the bot's under other names.
	const env = { ...process.env, API: api.url, FOLDER: folder, BOT_TOKEN: TOKEN, CHAT_ID: String(CHAT) };
	const child = spawn(process.execPath, ["--input-type=module", "-e", CHILD], { cwd: fileURLToPath(new URL("../../..", import.meta.url)), env, stdio: ["pipe", "pipe", "inherit"] });
	t.after(() => child.kill());
	const exited = once(child, "exit");
	await Promise.race([once(child.stdout, "data"), exited]);
	child.stdin.end("go\n");
	for (let i = 0; i < 20; i++) fake.emit("notice", { text: `parent ${i}` });
	assert.deepEqual(await exited, [0, null]);
	await until("40 sent", () => api.took().length >= 40 && queued().length === 0);
	const texts = api.took().map((sent) => sent.text as string);
	assert.equal(new Set(texts).size, 40, `each once: ${texts.length} sent`);
	for (const who of ["parent", "child"])
		assert.deepEqual(
			texts.filter((text) => text.startsWith(who)),
			Array.from({ length: 20 }, (_, i) => `${who} ${i}`),
		);
});

// Each default `table` writes as a value, by its path, parsed as JSON when it parses; `words` are the paths of those written as
// words for a person, left out.
function valueDefaults(table: OptionTable, words: readonly string[]): Record<string, unknown> {
	const value = (text: string): unknown => {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	};
	return Object.fromEntries(everyOption(table).flatMap(({ path, entry }) => (entry.default === undefined || words.includes(path) ? [] : [[path, value(entry.default)]])));
}

test("each default the option table writes as a value is the one the code applies with nothing set", () => {
	assert.deepEqual(valueDefaults(table, ["bots.*.name"]), { apiUrl: API_URL });
});

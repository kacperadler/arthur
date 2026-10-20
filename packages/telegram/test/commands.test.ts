import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Command, Host } from "@arthur/core/plugin";
import { temporaryFolder } from "@arthur/core/testing";
import { botApi, CHAT, load, SECOND, said, TOKEN, until } from "./fake-bot-api.ts";

// Phone commands and the command menu (spec/roadmap.md, entry 50).

const docs = temporaryFolder();

type Reply = NonNullable<Command["phone"]>["reply"];

// A phone command on the fake host, as a plugin registers one; `about` is its line in the menu.
function phone(host: Host, name: string, reply: Reply, about = `the ${name}`): void {
	const doc = pathToFileURL(join(docs, `${name}.md`));
	writeFileSync(doc, `# arthur ${name}\n`);
	host.commands.register({ name, doc, run: () => 0, phone: { about, reply } });
}

// A command message as Telegram sends one: the text and its bot_command entity.
const command = (text: string, fields: Readonly<Record<string, unknown>> = {}) => ({ text, entities: [{ type: "bot_command", offset: 0, length: text.split(/\s/)[0]?.length ?? 0 }], ...fields });

test("/name text runs the phone command with its channel and place, the reply goes back there, and nothing reaches the coordinator", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, received } = await load(t, { apiUrl: api.url });
	const asked: unknown[] = [];
	phone(fake.host, "jobs", (text, from) => (asked.push([text, from]), `jobs: ${text || "none"}`));
	await plugin.start?.();
	api.push(command("/jobs all\nnow"));
	api.push(command("/jobs", { message_thread_id: 12, is_topic_message: true }));
	await until("both replies", () => api.took().length === 2);
	assert.deepEqual(api.took(), [
		{ chat_id: CHAT, text: "jobs: all\nnow", disable_notification: false },
		{ chat_id: CHAT, text: "jobs: none", disable_notification: false, message_thread_id: 12 },
	]);
	assert.deepEqual(asked, [["all\nnow", { channel: "telegram" }], ["", { channel: "telegram", place: "12" }]]);
	assert.deepEqual(received(), []);
});

test("/name@botname: this bot's name, in any case, is the command; another bot's is dropped; getMe asked once it answers", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, received, queued } = await load(t, { apiUrl: api.url });
	phone(fake.host, "jobs", (text) => `jobs ${text}`);
	await plugin.start?.();
	api.fail("getMe", 502, "Bad Gateway");
	api.push(command("/jobs@shop_bot unknown name"));
	api.push(command("/jobs@arthur_bot one"));
	api.push(command("/jobs@Arthur_Bot two"));
	api.push(command("/jobs@shop_bot three"));
	api.push({ text: "After them." });
	// In order: once the text after them is received, every reply is queued; once the outbox is empty, each went.
	await until("the text after them, and the replies sent", () => received().length === 1 && queued().length === 0 && api.took().length >= 3);
	assert.deepEqual(
		api.took().map((sent) => sent.text),
		["jobs unknown name", "jobs one", "jobs two"],
		"a name getMe could not check counts as this bot's; the last, to another bot, gets nothing",
	);
	assert.deepEqual(received(), [{ channel: "telegram", parts: said("After them.") }]);
	assert.equal(api.calls.filter((call) => call.method === "getMe").length, 2, "asked again after its failure, then kept");
});

test("a named bot's command is answered by that bot, its own name after the @, and the command learns the bot's name", async (t) => {
	const api = await botApi(t);
	const bots = [{ name: "shop", botTokenEnv: "ARTHUR_TELEGRAM_SHOP_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_SHOP_CHAT_ID" }];
	const env = { ARTHUR_TELEGRAM_SHOP_BOT_TOKEN: SECOND, ARTHUR_TELEGRAM_SHOP_CHAT_ID: String(CHAT) };
	const { fake, plugin } = await load(t, { apiUrl: api.url, bots }, { env });
	const asked: unknown[] = [];
	phone(fake.host, "jobs", (_, from) => (asked.push(from), "none"));
	await plugin.start?.();
	api.push(command("/jobs@arthur_bot", { message_thread_id: 12, is_topic_message: true }), 5, SECOND);
	api.push(command("/jobs@shop_bot", { message_thread_id: 12, is_topic_message: true }), 5, SECOND);
	await until("the reply", () => api.took(SECOND).length === 1);
	assert.deepEqual(api.took(SECOND), [{ chat_id: CHAT, message_thread_id: 12, text: "none", disable_notification: false }]);
	assert.deepEqual(asked, [{ channel: "telegram", place: "12", instance: "shop" }]);
});

test("an unknown command gets the registry's line; a slash that is no command is a message to the coordinator", async (t) => {
	const api = await botApi(t);
	const { fake, plugin, received, queued } = await load(t, { apiUrl: api.url });
	phone(fake.host, "jobs", () => "none");
	phone(fake.host, "board", () => "empty");
	await plugin.start?.();
	api.push(command("/nope x"));
	api.push(command("/Jobs"));
	const texts = ["/tmp/x is full", "/ hi", `/${"a".repeat(33)}`, "see /jobs"];
	for (const text of texts) api.push({ text });
	await until("the messages, and the replies sent", () => received().length === texts.length && queued().length === 0 && api.took().length >= 2);
	assert.deepEqual(
		api.took().map((sent) => sent.text),
		["unknown command /nope; phone commands: /board, /jobs", "unknown command /Jobs; phone commands: /board, /jobs"],
	);
	assert.deepEqual(received(), texts.map((text) => ({ channel: "telegram", parts: said(text) })));
});

test("a command's reply longer than one message goes in slices, in order, to its place", async (t) => {
	const api = await botApi(t);
	const { fake, plugin } = await load(t, { apiUrl: api.url });
	const [a, b] = ["a".repeat(3000), "b".repeat(3000)];
	phone(fake.host, "board", () => `${a}\n${b}`);
	await plugin.start?.();
	api.push(command("/board all", { message_thread_id: 7, is_topic_message: true }));
	await until("both slices", () => api.took().length === 2);
	assert.deepEqual(api.took(), [a, b].map((text) => ({ chat_id: CHAT, text, disable_notification: false, message_thread_id: 7 })));
});

test("the session's start notice goes as it comes, its doctor lines included", async (t) => {
	const api = await botApi(t);
	const { fake, plugin } = await load(t, { apiUrl: api.url });
	const text = "core cgroups: missing: no user manager; fix: see docs/setup.md\ncoordinator up on vps";
	fake.emit("notice", { text });
	await plugin.start?.();
	await until("the notice", () => api.took().length === 1);
	assert.deepEqual(api.took(), [{ chat_id: CHAT, text, disable_notification: false }]);
});

test("the menu is the phone commands, set at a start only when they changed since the last one set, per bot", async (t) => {
	const api = await botApi(t);
	const bots = [
		{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" },
		{ name: "shop", botTokenEnv: "ARTHUR_TELEGRAM_SHOP_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_SHOP_CHAT_ID" },
	];
	const env = { ARTHUR_TELEGRAM_BOT_TOKEN: TOKEN, ARTHUR_TELEGRAM_CHAT_ID: String(CHAT), ARTHUR_TELEGRAM_SHOP_BOT_TOKEN: SECOND, ARTHUR_TELEGRAM_SHOP_CHAT_ID: String(CHAT) };
	const folder = temporaryFolder();
	// One start of `arthur run` with these commands, stopped once its menu calls and first polls are done.
	const start = async (names: readonly string[], ready: () => boolean) => {
		const box = await load(t, { apiUrl: api.url, bots }, { env, folder });
		for (const name of names) phone(box.fake.host, name, () => "ok");
		const before = api.polls().length;
		await box.plugin.start?.();
		await until("the menu and a poll", () => ready() && api.polls().length > before && api.polls(SECOND).length > 0);
		await box.plugin.stop?.();
		return box.errors;
	};
	const set = (...names: string[]) => ({ method: "setMyCommands", commands: names.map((name) => ({ command: name, description: `the ${name}` })) });
	const record = () => JSON.parse(readFileSync(join(folder, "menu.json"), "utf8")) as Record<string, unknown>;

	await start(["jobs", "board"], () => api.menus().length === 1 && api.menus(SECOND).length === 1);
	assert.deepEqual([api.menus(), api.menus(SECOND)], [[set("board", "jobs")], [set("board", "jobs")]], "sorted by name, each bot its own");
	assert.deepEqual(Object.keys(record()).sort(), [TOKEN, SECOND].map((token) => token.split(":")[0]).sort(), "keyed by the bot's id, never its token");
	assert.ok(!readFileSync(join(folder, "menu.json"), "utf8").includes(TOKEN.split(":")[1] ?? "-"));

	await start(["board", "jobs"], () => true);
	assert.equal(api.menus().length + api.menus(SECOND).length, 2, "the same commands: nothing set again");

	await start(["board", "jobs", "plan"], () => api.menus().length === 2 && api.menus(SECOND).length === 2);
	assert.deepEqual(api.menus()[1], set("board", "jobs", "plan"));

	writeFileSync(join(folder, "menu.json"), "{ broken");
	await start(["board", "jobs", "plan"], () => api.menus().length === 3 && api.menus(SECOND).length === 3);
	assert.deepEqual(api.menus(SECOND)[2], set("board", "jobs", "plan"), "a record that does not parse records nothing");

	api.fail("deleteMyCommands", 400, "Bad Request: not enough rights");
	const errors = await start([], () => api.menus().length === 4 && api.menus(SECOND).length === 4);
	assert.deepEqual(api.menus()[3], { method: "deleteMyCommands" }, "no phone command: the menu deleted");
	assert.deepEqual(errors, ["telegram bot (unnamed): deleteMyCommands: 400: Bad Request: not enough rights; the command menu is set again at the next start"]);
	assert.equal(record()[TOKEN.split(":")[0] ?? ""], JSON.stringify(set("board", "jobs", "plan").commands), "a failed call keeps the record");

	await start([], () => api.menus().length === 5);
	assert.deepEqual([api.menus()[4], api.menus(SECOND).length], [{ method: "deleteMyCommands" }, 4], "tried again at the next start, only where it failed");
});

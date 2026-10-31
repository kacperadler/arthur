import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { everyOption, type OptionTable } from "@arthur/core/option-table";
import type { Requirement } from "@arthur/core/plugin";
import { fakeHost, until } from "@arthur/core/testing";
import { checkOptions, table } from "../src/discord-options.ts";
import { API_URL, discord } from "../src/discord.ts";
import { ELSEWHERE, OTHER } from "../src/receive.ts";
import { slices } from "../src/slices.ts";
import { BOT, fakeDiscord, GUILD, load, MAIN, message, NOW, OWNER, PROJECT, SECOND, STRANGER, said, snowflake, THREAD, TOKEN, user } from "./fake-discord.ts";

const BOT_OPTIONS = { tokenEnv: "ARTHUR_DISCORD_BOT_TOKEN", guildIdEnv: "ARTHUR_DISCORD_GUILD_ID", userIdEnv: "ARTHUR_DISCORD_USER_ID", channelIdEnv: "ARTHUR_DISCORD_CHANNEL_ID" };
const ENV = { ARTHUR_DISCORD_BOT_TOKEN: TOKEN, ARTHUR_DISCORD_GUILD_ID: GUILD, ARTHUR_DISCORD_USER_ID: OWNER, ARTHUR_DISCORD_CHANNEL_ID: MAIN };
const sent = (channel: string, content: string, flags = 0) => ({ channel, body: { content, allowed_mentions: { parse: [] }, flags } });

test("options: bots is a list of at least one, each with its four variables, at most one unnamed, names unique; apiUrl an https URL or loopback http", () => {
	assert.deepEqual(checkOptions({ bots: [BOT_OPTIONS, { ...BOT_OPTIONS, name: "second" }], apiUrl: "http://127.0.0.1:1" }), []);
	assert.deepEqual(checkOptions({ bots: [] }), [{ path: "bots", problem: "expected a list of at least one bot, got an empty list" }]);
	assert.deepEqual(checkOptions({ bots: [BOT_OPTIONS, BOT_OPTIONS, { ...BOT_OPTIONS, name: "x" }, { ...BOT_OPTIONS, name: "x" }], media: true, apiUrl: "http://discord.com" }), [
		{ path: "media", problem: "unknown option; options: bots, apiUrl" },
		{ path: "apiUrl", problem: 'expected an https URL, or an http one on loopback (localhost, 127.0.0.0/8, ::1), got "http://discord.com"' },
		{ path: "bots[1]", problem: "bots[0] has no name either; at most one bot is unnamed" },
		{ path: "bots[3].name", problem: "x is the name of bots[2] too" },
	]);
	const { channelIdEnv: _, ...three } = BOT_OPTIONS;
	assert.deepEqual(checkOptions({ bots: [{ ...three, name: "Big", tokenEnv: "", chat: 1 }, 7] }), [
		{ path: "bots[0].chat", problem: "unknown key; keys: name, tokenEnv, guildIdEnv, userIdEnv, channelIdEnv" },
		{ path: "bots[0].name", problem: 'expected lowercase letters, digits and single dashes, from a letter, got "Big"' },
		{ path: "bots[0].tokenEnv", problem: 'expected the name of an env variable, got ""' },
		{ path: "bots[0].channelIdEnv", problem: "expected the name of an env variable, got nothing" },
		{ path: "bots[1]", problem: "expected a bot { name?, tokenEnv, guildIdEnv, userIdEnv, channelIdEnv }, got 7" },
	]);
});

test("a variable missing, or a token or an id Discord could not take, refuses the load, naming the option and the variable, never the value", async (t) => {
	const refused = async (env: Readonly<Record<string, string>>) => {
		const options = { bots: [BOT_OPTIONS] };
		const error = await fakeHost({ name: "discord", env, options }).setup(discord(options)).then(() => undefined, (failed: Error) => failed.message);
		// A value long enough not to be part of the message by chance, as "0" is of "bots[0]".
		for (const value of Object.values(env)) if (value.length > 4) assert.ok(!error?.includes(value), error);
		return error;
	};
	t.mock.method(console, "error", () => {});
	const token = "bots[0].tokenEnv: ARTHUR_DISCORD_BOT_TOKEN does not hold a bot token as Discord's developer portal gives it: three parts of letters, digits, _ and -, joined by dots";
	for (const value of ["secret token", `${TOKEN}.x`, TOKEN.replace(".", ""), ""]) assert.equal(await refused({ ...ENV, ARTHUR_DISCORD_BOT_TOKEN: value }), token, value);
	const { ARTHUR_DISCORD_GUILD_ID: _, ...noGuild } = ENV;
	assert.equal(await refused(noGuild), "bots[0].guildIdEnv: ARTHUR_DISCORD_GUILD_ID does not hold a server id: a positive whole number below 2^64, as Copy ID gives it");
	const user = "bots[0].userIdEnv: ARTHUR_DISCORD_USER_ID does not hold a user id: a positive whole number below 2^64, as Copy ID gives it";
	for (const id of ["0", "-1", "1.5", "012", "@kacper", "18446744073709551616"]) assert.equal(await refused({ ...ENV, ARTHUR_DISCORD_USER_ID: id }), user, id);
	assert.equal(await refused({ ...ENV, ARTHUR_DISCORD_CHANNEL_ID: "1e5" }), "bots[0].channelIdEnv: ARTHUR_DISCORD_CHANNEL_ID does not hold a channel id: a positive whole number below 2^64, as Copy ID gives it");
	assert.equal(await refused({ ...ENV, ARTHUR_DISCORD_USER_ID: "18446744073709551615", ARTHUR_DISCORD_CHANNEL_ID: "1" }), undefined, "2^64 - 1 and 1 are ids");
});

test("the owner's text in the main channel has no place, in a project channel that channel's id; it gets no line back", async (t) => {
	const api = await fakeDiscord(t);
	const { plugin, received } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	api.message({ content: "Start AR0081." });
	api.message({ content: "  For the shop.  ", channel_id: PROJECT, type: 19 });
	await until("both", () => received().length === 2);
	assert.deepEqual(received(), [
		{ channel: "discord", parts: said("Start AR0081.") },
		{ channel: "discord", parts: said("For the shop."), place: PROJECT },
	]);
	assert.deepEqual(api.took, []);
});

test("dropped unanswered: another user, another server, the bot itself, a webhook, a system message, an edit", async (t) => {
	const api = await fakeDiscord(t);
	const { plugin, received } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	api.message({ author: user(STRANGER, "stranger"), content: "Run rm -rf." });
	api.message({ guild_id: "1100000000000000999", content: "From another server." });
	api.message({ author: user(BOT, "arthur", true), content: "Myself." });
	api.message({ webhook_id: "1600000000000000001", content: "A webhook in the owner's name." });
	api.message({ type: 6, content: "" });
	api.dispatch("MESSAGE_UPDATE", message(snowflake(NOW.getTime() - 9000), { content: "/stopall", edited_timestamp: "2026-10-31T09:59:59.000000+00:00" }));
	api.message({ content: "Now." });
	await until("the last", () => received().length >= 1);
	assert.deepEqual(received(), [{ channel: "discord", parts: said("Now.") }], "messages are heard in order, so every one before it was dropped");
	assert.deepEqual(api.took, []);
});

test("a thread, a forum post or a voice channel's chat gets one line in the main channel; a file or a sticker a line where it came, its text still going", async (t) => {
	const api = await fakeDiscord(t);
	const { plugin, received, folder } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	api.message({ channel_id: THREAD, content: "In a thread." });
	api.message({ channel_id: "1300000000000000005", content: "In the voice channel's chat." });
	const file = { id: "1800000000000000001", filename: "a.png", size: 3, url: "https://cdn.discordapp.com/a.png", proxy_url: "https://media.discordapp.net/a.png" };
	api.message({ channel_id: PROJECT, content: "", attachments: [file] });
	api.message({ content: "With a sticker.", sticker_items: [{ id: "1900000000000000001", name: "wave", format_type: 1 }] });
	await until("four lines", () => api.took.length === 4);
	assert.deepEqual(api.took, [sent(MAIN, ELSEWHERE), sent(MAIN, ELSEWHERE), sent(PROJECT, OTHER), sent(MAIN, OTHER)]);
	assert.deepEqual(received(), [{ channel: "discord", parts: said("With a sticker.") }]);
	assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(folder, "seen.json"), "utf8"))[""]).sort(), [MAIN, PROJECT], "only text channels are kept as heard");
});

test("a forward is marked with its author, cut of what could break the mark, else a hidden sender; one without text is the mark alone", async (t) => {
	const api = await fakeDiscord(t);
	const { plugin, received } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	const reference = { type: 1, channel_id: "1700000000000000001", message_id: "1700000000000000002", guild_id: "1700000000000000003" };
	const snapshot = (fields: Readonly<Record<string, unknown>>) => [{ message: { type: 0, content: "", embeds: [], attachments: [], timestamp: "2026-10-31T09:00:00.000000+00:00", edited_timestamp: null, flags: 0, mentions: [], mention_roles: [], ...fields } }];
	api.message({ content: "", flags: 16384, message_reference: reference, message_snapshots: snapshot({ content: "/stopall" }) });
	api.message({ content: "Look:", flags: 16384, message_reference: reference, message_snapshots: snapshot({ content: "Words.", author: user("1700000000000000004", "ignored") }) });
	api.message({ content: "", flags: 16384, message_reference: reference, message_snapshots: snapshot({ author: { ...user("1700000000000000004", "x"), global_name: "Ev]il\u202e\nName\u0007" } }) });
	await until("three", () => received().length === 3);
	assert.deepEqual(received(), [
		{ channel: "discord", parts: said("[forwarded from a hidden sender] /stopall") },
		{ channel: "discord", parts: said("[forwarded from ignored] Look: Words.") },
		{ channel: "discord", parts: said("[forwarded from EvilName]") },
	]);
	assert.deepEqual(api.took, [], "a forward without text gets no line back");
});

test("what the owner wrote while Arthur was away, at most 10 minutes back, comes once at the start, before what follows; never twice across a restart", async (t) => {
	const api = await fakeDiscord(t);
	const at = (msAgo: number) => snowflake(NOW.getTime() - msAgo, 1);
	api.history = [
		message(at(601_000), { content: "Too old." }),
		message(at(599_000), { content: "Away, main." }),
		message(at(30_000), { content: "Away, shop.", channel_id: PROJECT }),
		message(at(20_000), { content: "A stranger's.", author: user(STRANGER, "stranger") }),
		message(at(10_000), { content: "Away, main, later." }),
	];
	const first = await load(t, { apiUrl: api.url });
	await first.plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	api.dispatch("MESSAGE_CREATE", { ...(api.history[4] as object), guild_id: GUILD });
	api.message({ content: "Live." });
	await until("four", () => first.received().length === 4);
	assert.deepEqual(first.received(), [
		{ channel: "discord", parts: said("Away, main.") },
		{ channel: "discord", parts: said("Away, main, later.") },
		{ channel: "discord", parts: said("Away, shop."), place: PROJECT },
		{ channel: "discord", parts: said("Live.") },
	]);
	assert.ok(api.calls.some((call) => call.path === `/channels/${MAIN}/messages?after=${snowflake(NOW.getTime() - 600_000)}&limit=100`), "10 minutes back when nothing was heard yet");
	await first.plugin.stop?.();
	const live = api.history.length;
	const second = await load(t, { apiUrl: api.url }, { folder: first.folder });
	await second.plugin.start?.();
	await until("identified again", () => api.sent(2).length === 2);
	api.message({ content: "After the restart." });
	await until("it", () => second.received().length >= 1);
	assert.deepEqual(second.received(), [{ channel: "discord", parts: said("After the restart.") }]);
	assert.equal(api.history.length, live);
	assert.ok(api.calls.some((call) => call.path.startsWith(`/channels/${PROJECT}/messages?after=${at(30_000)}&`)), "after the last message heard there");
	writeFileSync(join(first.folder, "seen.json"), "{ broken");
	const third = await load(t, { apiUrl: api.url }, { folder: first.folder });
	await third.plugin.start?.();
	await until("a broken seen.json reads as nothing heard", () => third.received().length === 3);
});

test("replies go when their channels hold discord or are empty, notices unless coordinator.silent holds them, in order, none before the start", async (t) => {
	const api = await fakeDiscord(t);
	const { fake, plugin, asked, queued } = await load(t, { apiUrl: api.url }, { held: (notice) => (notice as { text: string }).text === "held" });
	fake.emit("coordinator-replied", { text: "To the owner.", answers: [1], channels: ["telegram", "discord"] });
	fake.emit("coordinator-replied", { text: "Only Telegram.", answers: [2], channels: ["telegram"] });
	fake.emit("coordinator-replied", { text: "A job ended.", answers: [3], channels: [] });
	fake.emit("notice", { text: "held" });
	fake.emit("notice", { text: "AR1 asks: may I?", place: PROJECT });
	fake.emit("notice", { text: "To no channel of the server.", place: "1300000000000000099" });
	fake.emit("coordinator-replied", { text: "@everyone look", answers: [4] });
	const fetched = t.mock.method(globalThis, "fetch");
	await new Promise(setImmediate);
	assert.equal(fetched.mock.callCount(), 0, "nothing goes before the start, the replay of the log included");
	assert.deepEqual(queued(), [], "nor is queued: a command that loads the plugin and never starts it writes no outbox");
	fetched.mock.restore();
	await plugin.start?.();
	await until("five sends", () => api.took.length === 5);
	assert.deepEqual(api.took, [sent(MAIN, "To the owner."), sent(MAIN, "A job ended."), sent(PROJECT, "AR1 asks: may I?"), sent(MAIN, "To no channel of the server."), sent(MAIN, "@everyone look")]);
	assert.deepEqual(asked, [{ text: "held" }, { text: "AR1 asks: may I?", place: PROJECT }, { text: "To no channel of the server.", place: "1300000000000000099" }]);
});

test("slices of at most 2000 cut at line breaks; in quiet hours with SUPPRESS_NOTIFICATIONS; a 429 waits its retry_after", async (t) => {
	const api = await fakeDiscord(t);
	const { fake, plugin, queued } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	const [a, b] = ["a".repeat(1500), "b".repeat(500)];
	fake.emit("notice", { text: `${a}\n${b}` });
	await until("two slices", () => api.took.length === 2);
	assert.deepEqual(api.took, [sent(MAIN, a), sent(MAIN, b)], "2001 characters, two slices");
	assert.deepEqual(slices("x".repeat(2000), 2000), ["x".repeat(2000)], "2000 exactly is one");
	fake.setNow(new Date("2026-10-31T22:30:00Z"));
	fake.emit("notice", { text: "23:30 in Warsaw" });
	await until("the quiet one", () => api.took.length === 3);
	assert.deepEqual(api.took[2], sent(MAIN, "23:30 in Warsaw", 4096));
	fake.setNow(NOW);
	api.fail(`POST /channels/${MAIN}/messages`, 429, { message: "You are being rate limited.", retry_after: 1.5, global: false });
	fake.emit("notice", { text: "After the wait." });
	await until("the retry", () => api.took.length === 4);
	const [limited, retried] = api.calls.filter((call) => call.method === "POST").slice(-2);
	assert.ok(limited !== undefined && retried !== undefined && retried.at - limited.at >= 1490, `${retried?.at} - ${limited?.at}`);
	assert.deepEqual(api.took[3], sent(MAIN, "After the wait."), "the rate-limited slice itself goes after the wait");
	assert.deepEqual(queued("refused"), [], "a 429 is no refusal: nothing set aside");
});

test("a refused slice (404, a channel gone) is set aside and told once; a channel deleted sends to the main one; CHANNEL_CREATE adds one", async (t) => {
	const api = await fakeDiscord(t);
	const { fake, plugin, errors, queued, folder, notices, received } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	const gone = "1300000000000000008";
	api.dispatch("CHANNEL_CREATE", { id: gone, type: 0, guild_id: GUILD, name: "gone" });
	api.dispatch("CHANNEL_CREATE", { id: "1300000000000000010", type: 15, guild_id: GUILD, name: "a forum" });
	api.message({ content: "A mark that the events before it were heard." });
	await until("heard", () => received().length === 1);
	fake.emit("notice", { text: "To the gone channel.", place: gone });
	fake.emit("notice", { text: "Again.", place: gone });
	await until("both set aside", () => queued("refused").length === 2);
	assert.equal(api.calls.filter((call) => call.method === "POST" && call.path === `/channels/${gone}/messages`).length, 2, "a refused slice is not tried again");
	const [first] = queued("refused").sort();
	const aside = join(folder, "outbox", "refused", first ?? "");
	assert.equal(errors[0], `discord bot (unnamed): POST /channels/${gone}/messages: 404: Unknown Channel; the slice is set aside in ${aside}`);
	assert.deepEqual(notices().slice(-1), [`discord bot (unnamed): POST /channels/${gone}/messages: 404: Unknown Channel; this slice was set aside in ${aside}:\nTo the gone channel.`]);
	await until("the told notice sent", () => api.took.length === 1);
	assert.equal(notices().length, 1, "told once: the second refusal is not told again");
	api.dispatch("CHANNEL_DELETE", { id: gone, type: 0, guild_id: GUILD });
	api.message({ content: "A mark that the delete was heard." });
	await until("heard", () => received().length === 2);
	fake.emit("notice", { text: "After the delete.", place: gone });
	fake.emit("notice", { text: "To the forum.", place: "1300000000000000010" });
	await until("both sent", () => api.took.length === 3);
	assert.deepEqual(api.took.slice(1), [sent(MAIN, "After the delete."), sent(MAIN, "To the forum.")]);
	assert.ok(JSON.parse(readFileSync(aside, "utf8")).text === "To the gone channel.");
});

test("Discord unreachable: the slices wait in the outbox through a restart, then go first, in order; a broken file in it is set aside", async (t) => {
	const api = await fakeDiscord(t);
	const down = await load(t, { apiUrl: "http://127.0.0.1:9" });
	await down.plugin.start?.();
	down.fake.emit("notice", { text: "First." });
	down.fake.emit("notice", { text: "Second." });
	await until("the failure said", () => down.errors.some((line) => line.includes(`POST /channels/${MAIN}/messages`)));
	await down.plugin.stop?.();
	assert.equal(down.queued().length, 2);
	mkdirSync(join(down.folder, "outbox"), { recursive: true });
	writeFileSync(join(down.folder, "outbox", "0-broken.json"), JSON.stringify({ bot: null, text: "To a place that is no id.", place: "general" }));
	const back = await load(t, { apiUrl: api.url }, { folder: down.folder });
	await back.plugin.start?.();
	await until("both sent", () => api.took.length === 2);
	assert.deepEqual(api.took, [sent(MAIN, "First."), sent(MAIN, "Second.")]);
	assert.deepEqual(back.queued("refused"), ["0-broken.json"]);
	assert.ok(back.errors[0]?.startsWith(`discord: ${join(down.folder, "outbox", "0-broken.json")} is not a slice { bot, text, place? }`));
});

test("every bot hears its own server; a reply goes by each bot the messages it answers came through, the rest by the unnamed one", async (t) => {
	const api = await fakeDiscord(t);
	const bots = [{ ...BOT_OPTIONS, name: "second", tokenEnv: "ARTHUR_DISCORD_SECOND_BOT_TOKEN" }, BOT_OPTIONS];
	const { fake, plugin, received } = await load(t, { apiUrl: api.url, bots }, { env: { ...ENV, ARTHUR_DISCORD_SECOND_BOT_TOKEN: SECOND } });
	await plugin.start?.();
	await until("both identified", () => api.sent(2).length === 2);
	const to = (token: string) => api.connections.find((each) => each.got.some((payload) => payload.op === 2 && (payload.d as { token?: unknown }).token === token));
	to(SECOND)?.send({ op: 0, d: message(snowflake(NOW.getTime(), 1), { content: "To the second bot." }), s: 3, t: "MESSAGE_CREATE" });
	await until("the second's", () => received().length === 1);
	to(TOKEN)?.send({ op: 0, d: message(snowflake(NOW.getTime(), 2), { content: "To the unnamed bot." }), s: 3, t: "MESSAGE_CREATE" });
	await until("both", () => received().length === 2);
	assert.deepEqual(received(), [{ channel: "discord", parts: said("To the second bot."), instance: "second" }, { channel: "discord", parts: said("To the unnamed bot.") }]);
	const seq = (text: string) => fake.emitted.find((event) => event.name === "message-received" && JSON.stringify(event.data).includes(text))?.seq;
	fake.emit("coordinator-replied", { text: "To the second.", answers: [seq("To the second bot.")], channels: ["discord"] });
	fake.emit("coordinator-replied", { text: "To both.", answers: [seq("To the unnamed bot."), seq("To the second bot.")], channels: ["discord"] });
	fake.emit("notice", { text: "A notice." });
	await until("four sends", () => api.took.length === 4);
	const by = (token: string) => api.calls.filter((call) => call.method === "POST" && call.headers.authorization === `Bot ${token}`).map((call) => (call.body as { content: string }).content);
	assert.deepEqual(by(SECOND), ["To the second.", "To both."]);
	assert.deepEqual(by(TOKEN), ["To both.", "A notice."]);
});

// Each requirement the plugin provides to `arthur doctor`: its name, its check's line and whether it is critical.
async function doctor(t: TestContext, apiUrl: string, env = ENV) {
	const { fake } = await load(t, { apiUrl }, { env });
	const [list = []] = fake.collect<readonly Requirement[]>("doctor");
	return Promise.all(list.map(async (each) => [each.name, await each.check(), each.critical === true, each.fix] as const));
}

test("doctor: the token, the Message Content Intent, the server's 2FA and its two members, each ok or missing with its fix; none critical; Discord not reached is ok", async (t) => {
	const api = await fakeDiscord(t);
	const lines = await doctor(t, api.url);
	assert.deepEqual(lines.map(([name, line, critical]) => [name, line, critical]), [
		["bot (unnamed): token", "ok", false],
		["bot (unnamed): Message Content Intent", "ok", false],
		["bot (unnamed): server 2FA", "ok", false],
		["bot (unnamed): server members", "ok", false],
	]);
	assert.equal(api.calls.length, 2, "each call once per doctor run");
	[api.flags, api.mfa, api.members] = [1 << 18, 0, 3];
	const [, intent, mfa, members] = await doctor(t, api.url);
	assert.equal(intent?.[1], "ok", "GATEWAY_MESSAGE_CONTENT, for 100 servers or more, counts too");
	assert.deepEqual([mfa?.[1], mfa?.[3]], ["missing: the server does not require 2FA for moderation", "turn on 2FA on your Discord account, then Require 2FA for moderator actions in the server's Safety Setup"]);
	assert.deepEqual([members?.[1], members?.[3]], ["missing: 3 members, not 2 (you and the bot)", "remove every member but you and the bot in the server's Members settings"]);
	api.flags = 0;
	assert.equal((await doctor(t, api.url))[1]?.[1], "missing: the intent is off, so Discord refuses the connection (4014)");
	const wrong = ["MTQwMDAwMDAwMDAwMDAwMDAwNw", "Gx3k9Q", "w".repeat(38)].join(".");
	const refused = await doctor(t, api.url, { ...ENV, ARTHUR_DISCORD_BOT_TOKEN: wrong });
	assert.deepEqual(refused[0]?.slice(1), ["missing: Discord refused the token (discord bot (unnamed): GET /applications/@me: 401: 401: Unauthorized)", false, "reset the token on the Bot page of the application at discord.com/developers/applications and put it in ARTHUR_DISCORD_BOT_TOKEN"]);
	assert.ok(!JSON.stringify(refused).includes(wrong));
	// A Discord that takes the connection and never answers: not reached either, before the doctor's own 10 s.
	const silent = createServer(() => {}).listen(0, "127.0.0.1");
	await once(silent, "listening");
	t.after(() => {
		silent.closeAllConnections();
		silent.close();
	});
	const asked = Date.now();
	const hung = await doctor(t, `http://127.0.0.1:${(silent.address() as AddressInfo).port}`);
	assert.equal(hung[0]?.[1], "ok (Discord not reached: discord bot (unnamed): GET /applications/@me: no answer in time)");
	assert.ok(Date.now() - asked < 9000, `under the doctor's own 10 s: ${Date.now() - asked} ms`);
	const away = await doctor(t, "http://127.0.0.1:9");
	assert.deepEqual(away.map(([, line]) => line), [
		"ok (Discord not reached: discord bot (unnamed): GET /applications/@me: cannot reach Discord's API)",
		"ok (Discord not reached: discord bot (unnamed): GET /applications/@me: cannot reach Discord's API)",
		`ok (Discord not reached: discord bot (unnamed): GET /guilds/${GUILD}: cannot reach Discord's API)`,
		`ok (Discord not reached: discord bot (unnamed): GET /guilds/${GUILD}: cannot reach Discord's API)`,
	]);
});

// Each default `table` writes as a value, by its path, parsed as JSON when it parses; `words` are the paths of those written as
// words for a person, left out.
function valueDefaults(options: OptionTable, words: readonly string[]): Record<string, unknown> {
	const value = (text: string): unknown => {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	};
	return Object.fromEntries(everyOption(options).flatMap(({ path, entry }) => (entry.default === undefined || words.includes(path) ? [] : [[path, value(entry.default)]])));
}

test("each default the option table writes as a value is the one the code applies with nothing set", () => {
	assert.deepEqual(valueDefaults(table, ["bots.*.name"]), { apiUrl: API_URL });
});

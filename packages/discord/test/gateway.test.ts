import assert from "node:assert/strict";
import { test } from "node:test";
import { until } from "@arthur/core/testing";
import { fakeDiscord, load, TOKEN } from "./fake-discord.ts";

const PORTAL = "discord.com/developers/applications";

test("identify asks for intents 33281 alone; a heartbeat with no ACK before the next closes with 4000 and resumes at the last sequence, never identifying again", async (t) => {
	const api = await fakeDiscord(t);
	api.heartbeat = 50;
	const { plugin } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	assert.deepEqual(api.sent(2)[0]?.d, { token: TOKEN, intents: 33281, properties: { os: process.platform, browser: "arthur", device: "arthur" } });
	const rest = api.calls.find((call) => call.path === "/gateway/bot");
	assert.deepEqual([rest?.headers.authorization, rest?.headers["user-agent"]], [`Bot ${TOKEN}`, "DiscordBot (https://github.com/kacperadler/arthur, 1)"]);
	assert.equal(api.connections[0]?.url, "/?v=10&encoding=json");
	await until("three heartbeats", () => api.sent(1).length >= 3);
	assert.equal(api.sent(1)[0]?.d, 2, "the heartbeat carries the last sequence: READY 1, GUILD_CREATE 2");
	assert.equal(api.connections[0]?.closed, undefined, "each acknowledged, so the connection holds");
	api.unacked = 1;
	await until("closed for the missing ACK", () => api.connections[0]?.closed !== undefined);
	assert.equal(api.connections[0]?.closed, 4000, "not 1000 or 1001, which would end the session");
	await until("resumed", () => api.sent(6).length === 1);
	assert.deepEqual(api.sent(6)[0]?.d, { token: TOKEN, session_id: "session-1", seq: 2 });
	assert.equal(api.connections[1]?.url, "/resume?v=10&encoding=json", "through resume_gateway_url");
	assert.equal(api.sent(2).length, 1);
});

test("op 7 and op 9 true resume; op 9 false identifies again after 1 to 5 s; 4007 and 4009 identify again", async (t) => {
	const api = await fakeDiscord(t);
	const { plugin } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	api.send({ op: 7, d: null, s: null, t: null });
	await until("resumed after op 7", () => api.sent(6).length === 1);
	api.send({ op: 9, d: true, s: null, t: null });
	await until("resumed after op 9 true", () => api.sent(6).length === 2);
	const asked = Date.now();
	api.send({ op: 9, d: false, s: null, t: null });
	await until("identified after op 9 false", () => api.sent(2).length === 2);
	assert.ok(Date.now() - asked >= 990, `waited ${Date.now() - asked} ms`);
	for (const [index, code] of [4007, 4009].entries()) {
		api.drop(code);
		await until(`identified after ${code}`, () => api.sent(2).length === 3 + index);
	}
	assert.equal(api.sent(6).length, 2, "none of those resumed");
});

test("a connection dropped 20 times resumes each time and identifies once", async (t) => {
	const api = await fakeDiscord(t);
	const { plugin } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	for (let drop = 1; drop <= 20; drop++) {
		api.drop(4000);
		await until(`resume ${drop}`, () => api.sent(6).length === drop);
	}
	assert.equal(api.sent(2).length, 1);
	assert.equal(api.calls.filter((call) => call.path === "/gateway/bot").length, 1, "a resume asks no new gateway address");
});

test("below 50 session starts left the bot does not identify, says so once and waits for their reset; at 50 it identifies", async (t) => {
	const low = await fakeDiscord(t);
	low.remaining = 49;
	const first = await load(t, { apiUrl: low.url });
	await first.plugin.start?.();
	await until("said", () => first.errors.length === 1);
	assert.deepEqual(first.errors, ["discord bot (unnamed): only 49 of Discord's daily session starts are left, and at none Discord resets the token; the bot connects again once they reset, in 14400 s"]);
	assert.equal(low.connections.length, 0);
	const stopping = Date.now();
	await first.plugin.stop?.();
	assert.ok(Date.now() - stopping < 5000, "the stop cuts the wait short");
	const enough = await fakeDiscord(t);
	enough.remaining = 50;
	const second = await load(t, { apiUrl: enough.url });
	await second.plugin.start?.();
	await until("identified", () => enough.sent(2).length === 1);
});

test("4004 and 4014 end the connection for good, said on stderr and in a notice with the fix, never with the token", async (t) => {
	for (const [code, words] of [
		[4004, `discord bot (unnamed): Discord refused the token in ARTHUR_DISCORD_BOT_TOKEN (4004 Authentication failed): reset it on the Bot page of the application at ${PORTAL}, put the new one in ARTHUR_DISCORD_BOT_TOKEN and restart Arthur`],
		[4014, `discord bot (unnamed): Discord refused the MESSAGE_CONTENT intent (4014 Disallowed intents): switch on Message Content Intent on the Bot page of the application at ${PORTAL} and restart Arthur`],
	] as const) {
		const api = await fakeDiscord(t);
		api.refuse = code;
		const { plugin, errors, notices } = await load(t, { apiUrl: api.url });
		await plugin.start?.();
		await until(`${code} said`, () => errors.length === 1);
		assert.deepEqual([errors, notices()], [[words], [words]]);
		await plugin.stop?.();
		assert.equal(api.connections.length, 1, "no second connection");
		assert.ok(!JSON.stringify([errors, notices()]).includes(TOKEN));
	}
});

test("a gateway address that is not wss: (ws: only on loopback) is refused before connecting; a failed GET /gateway/bot is said once and tried again", async (t) => {
	const api = await fakeDiscord(t);
	api.gatewayUrl = "ws://gateway.example.com";
	const { plugin, errors } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("refused", () => errors.length === 1);
	assert.deepEqual(errors, ['discord bot (unnamed): the gateway address "ws://gateway.example.com" is not wss:, and the token goes only over an encrypted connection']);
	assert.equal(api.connections.length, 0);
	const later = await fakeDiscord(t);
	later.fail("GET /gateway/bot", 502, { message: `Bad Gateway for ${TOKEN}`, code: 0 });
	const second = await load(t, { apiUrl: later.url });
	await second.plugin.start?.();
	await until("identified after the retry", () => later.sent(2).length === 1);
	assert.deepEqual(second.errors, ["discord bot (unnamed): GET /gateway/bot: 502: Bad Gateway for [token]; the gateway connects again in 1 s"], "the token never in a line");
});

test("stop closes the connection with 1000, so the bot shows offline; a plugin never started stops too", async (t) => {
	const api = await fakeDiscord(t);
	const { plugin } = await load(t, { apiUrl: api.url });
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	await plugin.stop?.();
	await until("closed", () => api.connections[0]?.closed !== undefined);
	assert.equal(api.connections[0]?.closed, 1000);
	const idle = await load(t, { apiUrl: api.url });
	await idle.plugin.stop?.();
});

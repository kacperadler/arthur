import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { until } from "@arthur/core/testing";
import { BOT, fakeDiscord, GUILD, MAIN, message, NOW, snowflake, TOKEN } from "./fake-discord.ts";

// The fields of each object a fake answer holds, recorded in discord-shapes.json from the field tables of Discord's documentation
// (its `source`, read on its `recorded` day). The fake changes shape only through a reviewed change of that file.
type Field = { readonly type: string; readonly optional?: true; readonly nullable?: true };
const { types } = JSON.parse(readFileSync(new URL("discord-shapes.json", import.meta.url), "utf8")) as { types: Record<string, Record<string, Field>> };

// Each way `got` leaves the documented `type`: `-` a field the documentation does not mark optional left out (not in a partial
// object), `+` a key the object does not have. `array of X objects` holds each item to X; `null` passes a nullable field; a type
// not recorded (snowflake, integer, role) holds no keys.
const drift = (got: unknown, type: string, at: string): string[] => {
	const item = /^array of (.+) objects$/.exec(type)?.[1];
	if (item !== undefined) return Array.isArray(got) ? got.flatMap((each, index) => drift(each, `${item} object`, `${at}[${index}]`)) : [`${at}: not an array`];
	const [, partial, name = type] = /^(partial )?(.+?)(?: object)?$/.exec(type) ?? [];
	const fields = types[name.toLowerCase()];
	if (fields === undefined) return [];
	if (got === null || typeof got !== "object" || Array.isArray(got)) return [`${at}: not an object`];
	const has = got as Record<string, unknown>;
	return [
		...(partial === undefined ? Object.entries(fields).filter(([key, field]) => field.optional !== true && !(key in has)).map(([key]) => `- ${at}.${key}`) : []),
		...Object.keys(has).filter((key) => !(key in fields)).map((key) => `+ ${at}.${key}`),
		...Object.entries(has).flatMap(([key, value]) => (value === null && fields[key]?.nullable === true ? [] : drift(value, fields[key]?.type ?? "", `${at}.${key}`))),
	];
};

test("every answer of the fake, REST and gateway, holds the fields Discord's documentation requires, and only fields it documents", async (t) => {
	const api = await fakeDiscord(t);
	api.history = [message(snowflake(NOW.getTime(), 1))];
	api.fail(`POST /channels/${MAIN}/messages`, 429, { message: "You are being rate limited.", retry_after: 1.5, global: false });
	const problems: string[] = [];
	// Each call: its path, its method and token, and the type its answer holds.
	const calls: readonly [string, string, string, string][] = [
		[`/channels/${MAIN}/messages`, "POST", TOKEN, "rate limit response"],
		["/gateway/bot", "GET", TOKEN, "get gateway bot"],
		["/applications/@me", "GET", TOKEN, "application"],
		[`/guilds/${GUILD}?with_counts=true`, "GET", TOKEN, "guild"],
		[`/channels/${MAIN}/messages?after=0&limit=100`, "GET", TOKEN, "array of message objects"],
		[`/channels/${MAIN}/messages`, "POST", TOKEN, "message"],
		[`/channels/${MAIN}`, "GET", TOKEN, "channel"],
		["/channels/1300000000000000099/messages", "POST", TOKEN, "error"],
		["/applications/@me", "GET", "wrong", "error"],
	];
	for (const [path, method, token, type] of calls) {
		const response = await fetch(`${api.url}${path}`, { method, headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify({ content: "hi" }) } : {}) });
		problems.push(...drift(await response.json(), type, `${method} ${path}`));
	}
	// A message with files, as channel.send makes one: its answer's attachments too.
	const form = new FormData();
	form.set("payload_json", JSON.stringify({ allowed_mentions: { parse: [] }, flags: 0, attachments: [{ id: 0, filename: "a.png" }] }));
	form.set("files[0]", new Blob(["png"]), "a.png");
	const upload = await fetch(`${api.url}/channels/${MAIN}/messages`, { method: "POST", headers: { Authorization: `Bot ${TOKEN}` }, body: form });
	const uploaded = (await upload.json()) as { attachments?: unknown };
	assert.equal(Array.isArray(uploaded.attachments) && uploaded.attachments.length, 1);
	problems.push(...drift(uploaded, "message", "POST multipart"));
	// The gateway: Hello, READY and GUILD_CREATE after Identify, an ACK, a message, then RESUMED on a second connection.
	const got: { op?: unknown; d?: unknown; t?: unknown }[] = [];
	const open = (path: string) => {
		const socket = new WebSocket(`${api.url.replace("http", "ws")}${path}`);
		socket.addEventListener("message", (event) => void got.push(JSON.parse(String(event.data))));
		t.after(() => socket.close());
		return socket;
	};
	const first = open("/?v=10&encoding=json");
	await until("Hello", () => got.length === 1);
	first.send(JSON.stringify({ op: 2, d: { token: TOKEN, intents: 33281, properties: { os: "linux", browser: "arthur", device: "arthur" } } }));
	await until("READY and GUILD_CREATE", () => got.length === 3);
	first.send(JSON.stringify({ op: 1, d: 2 }));
	await until("the ACK", () => got.length === 4);
	api.message({ flags: 8192, attachments: [api.attach("1800000000000000001", "voice-message.ogg", "ogg", { content_type: "audio/ogg", duration_secs: 3.5, waveform: "AAAA", flags: 0 })] });
	await until("the message", () => got.length === 5);
	const second = open("/resume?v=10&encoding=json");
	await until("Hello again", () => got.length === 6);
	second.send(JSON.stringify({ op: 6, d: { token: TOKEN, session_id: "session-1", seq: 3 } }));
	await until("RESUMED", () => got.length === 7);
	// A picked command, its deferred answer and its follow-up; the server's guild commands, set and read.
	const picked = api.interaction("jobs", "all");
	await until("the interaction", () => got.length === 8);
	const ask = async (path: string, method: string, body: unknown) =>
		(await fetch(`${api.url}${path}`, { method, headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })).text();
	assert.equal(await ask(`/interactions/${picked.id}/${picked.token}/callback`, "POST", { type: 5 }), "");
	problems.push(...drift(JSON.parse(await ask(`/webhooks/${BOT}/${picked.token}`, "POST", { content: "jobs: all" })), "message", "POST follow-up"));
	const commands = `/applications/${BOT}/guilds/${GUILD}/commands`;
	const set = [{ type: 1, name: "jobs", description: "the jobs", options: [{ type: 3, name: "text", description: "the text after the command", required: false }] }];
	problems.push(...drift(JSON.parse(await ask(commands, "PUT", set)), "array of application command objects", `PUT ${commands}`));
	const listed = await fetch(`${api.url}${commands}`, { headers: { Authorization: `Bot ${TOKEN}` } });
	problems.push(...drift(await listed.json(), "array of application command objects", `GET ${commands}`));
	const of: Readonly<Record<string, string>> = { READY: "ready", GUILD_CREATE: "guild create", MESSAGE_CREATE: "message create", INTERACTION_CREATE: "interaction" };
	for (const [index, payload] of got.entries()) {
		const at = `gateway[${index}] ${String(payload.t ?? payload.op)}`;
		problems.push(...drift(payload, "payload", at), ...drift(payload.d, payload.op === 10 ? "hello" : (of[String(payload.t)] ?? ""), `${at}.d`));
	}
	assert.deepEqual(got.map((payload) => payload.t ?? payload.op), [10, "READY", "GUILD_CREATE", 11, "MESSAGE_CREATE", 10, "RESUMED", "INTERACTION_CREATE"]);
	assert.equal(api.commands.length, 1);
	assert.deepEqual(problems, []);
});

test("the comparison names a required field left out, a key not documented at any depth, and passes a partial object's missing fields and a nullable null", () => {
	const user = { id: "1", username: "jane", discriminator: "0", global_name: null, avatar: null };
	assert.deepEqual(drift({ v: 10, user, guilds: [{ id: "2", unavailable: true }], session_id: "s", resume_gateway_url: "wss://x", application: { id: "3" } }, "ready", ""), []);
	assert.deepEqual(drift({ v: 10, user: { ...user, mood: "glad" }, guilds: [{ id: "2" }], session_id: "s", application: { id: "3", nope: 1 } }, "ready", ""), [
		"- .resume_gateway_url",
		"+ .user.mood",
		"- .guilds[0].unavailable",
		"+ .application.nope",
	]);
	const { global_name: _, ...nameless } = user;
	assert.deepEqual(drift(nameless, "user object", "u"), ["- u.global_name"]);
	assert.deepEqual(drift(user, "array of user objects", "at"), ["at: not an array"]);
	assert.deepEqual(drift(null, "user object", "at"), ["at: not an object"]);
	assert.deepEqual(drift("1", "snowflake", "at"), [], "a type not recorded holds no keys");
});

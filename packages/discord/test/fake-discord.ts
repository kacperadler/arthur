import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, readdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { type DiscordOptions, discord } from "../src/discord.ts";

// The fake Discord the discord tests share, REST API and gateway on one loopback port, and the plugin loaded on a fake host
// against it. Node has a WebSocket client but no server, so the gateway is the least of RFC 6455 over `node:http`'s upgrade:
// the handshake, unmasked text and close frames out, masked ones in.

// Built at run time, so no literal in the repository looks like a bot token to a secret scanner.
export const TOKEN = ["MTQwMDAwMDAwMDAwMDAwMDAwNQ", "Gx1k9Q", "t".repeat(38)].join(".");
export const SECOND = ["MTQwMDAwMDAwMDAwMDAwMDAwNg", "Gx2k9Q", "s".repeat(38)].join(".");
export const [GUILD, OWNER, MAIN, PROJECT, BOT, STRANGER] = ["1100000000000000001", "1200000000000000002", "1300000000000000003", "1300000000000000004", "1400000000000000005", "1500000000000000009"];
export const THREAD = "1300000000000000077";
export const NOW = new Date("2026-10-31T10:00:00Z");
const EPOCH = 1420070400000n;
// A snowflake of the moment `ms`, `n` telling apart those of one millisecond.
export const snowflake = (ms: number, n = 0) => String(((BigInt(ms) - EPOCH) << 22n) | BigInt(n));

export const user = (id: string, username: string, bot = false) => ({ id, username, discriminator: "0", global_name: bot ? null : username, avatar: null, ...(bot ? { bot: true } : {}) });
const channel = (id: string, type: number, name: string) => ({ id, type, guild_id: GUILD, position: 0, permission_overwrites: [], name, nsfw: false, parent_id: null, flags: 0, ...(type === 0 ? { topic: null, last_message_id: null, rate_limit_per_user: 0 } : {}) });
// A message as MESSAGE_CREATE gives one in the server's main channel, by the owner, every field the documentation does not mark optional.
export const message = (id: string, fields: Readonly<Record<string, unknown>> = {}) => ({
	id, channel_id: MAIN, guild_id: GUILD, author: user(OWNER, "kacper"), content: `message ${id}`, timestamp: "2026-10-31T09:59:55.000000+00:00", edited_timestamp: null,
	tts: false, mention_everyone: false, mentions: [], mention_roles: [], attachments: [], embeds: [], pinned: false, type: 0, ...fields,
});
const guild = (members: number, mfa: number) => ({
	id: GUILD, name: "Arthur", icon: null, splash: null, discovery_splash: null, owner_id: OWNER, afk_channel_id: null, afk_timeout: 300, verification_level: 0, default_message_notifications: 0, explicit_content_filter: 0,
	roles: [], emojis: [], features: [], mfa_level: mfa, application_id: null, system_channel_id: MAIN, system_channel_flags: 0, rules_channel_id: null, vanity_url_code: null, description: null, banner: null, premium_tier: 0,
	preferred_locale: "en-US", public_updates_channel_id: null, nsfw_level: 0, premium_progress_bar_enabled: false, safety_alerts_channel_id: null, incidents_data: null, approximate_member_count: members, approximate_presence_count: 1,
});
const application = (flags: number) => ({ id: BOT, name: "Arthur", icon: null, description: "", bot_public: false, bot_require_code_grant: false, verify_key: "a".repeat(64), team: null, flags });

export type FakeMessage = { readonly id: string; readonly channel_id: string } & Readonly<Record<string, unknown>>;
export type Call = { readonly method: string; readonly path: string; readonly headers: IncomingMessage["headers"]; readonly body: unknown; readonly at: number };
type Connection = { readonly url: string; readonly got: Readonly<Record<string, unknown>>[]; closed?: number; send(payload: unknown): void; close(code: number): void };

// The fake on a loopback port the OS picks. The gateway sends Hello, answers Identify with READY and GUILD_CREATE (a wrong token
// with 4004), Resume with RESUMED and each heartbeat with its ACK but the next `unacked`; `dispatch` sends an event, `drop` closes
// from Discord's side. REST answers what the documentation shows; `fail` scripts the next answer of a call, `history` is what
// `GET /channels/{id}/messages` reads. `took` is every message Discord took.
export async function fakeDiscord(t: TestContext) {
	const calls: Call[] = [];
	const took: { channel: string; body: Readonly<Record<string, unknown>> }[] = [];
	const connections: Connection[] = [];
	const failures: { call: string; status: number; body: unknown }[] = [];
	let [session, seq] = [0, 0];
	const json = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const server = createServer(async (request, response) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(chunk as Buffer);
		const url = new URL(request.url ?? "/", "http://fake");
		const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
		calls.push({ method: request.method ?? "", path: `${url.pathname}${url.search}`, headers: request.headers, body, at: Date.now() });
		const call = `${request.method} ${url.pathname}`;
		if (![TOKEN, SECOND].map((token) => `Bot ${token}`).includes(String(request.headers.authorization))) return json(response, 401, { message: "401: Unauthorized", code: 0 });
		const failure = failures.findIndex((each) => each.call === call);
		if (failure >= 0) {
			const [{ status, body: answer } = { status: 500, body: {} }] = failures.splice(failure, 1);
			return json(response, status, answer);
		}
		if (call === "GET /gateway/bot") return json(response, 200, { url: api.gatewayUrl ?? `ws://127.0.0.1:${port}`, shards: 1, session_start_limit: { total: 1000, remaining: api.remaining, reset_after: api.resetAfter, max_concurrency: 1 } });
		if (call === "GET /applications/@me") return json(response, 200, application(api.flags));
		if (call === `GET /guilds/${GUILD}`) return json(response, 200, guild(api.members, api.mfa));
		const id = /^\/channels\/(\d+)\/messages$/.exec(url.pathname)?.[1];
		if (id !== undefined && ![MAIN, PROJECT, ...api.extra].includes(id)) return json(response, 404, { message: "Unknown Channel", code: 10003 });
		if (id !== undefined && request.method === "POST") {
			took.push({ channel: id, body });
			return json(response, 200, message(snowflake(Date.now()), { channel_id: id, guild_id: undefined, author: user(BOT, "arthur", true), content: body.content, flags: body.flags ?? 0 }));
		}
		if (id !== undefined && request.method === "GET") {
			const since = BigInt(url.searchParams.get("after") ?? "0");
			return json(response, 200, api.history.filter((each) => each.channel_id === id && BigInt(each.id) > since).map(({ guild_id: _, ...each }) => each).toSorted((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1)).slice(0, Number(url.searchParams.get("limit") ?? 50)));
		}
		json(response, 404, { message: "404: Not Found", code: 0 });
	});
	server.on("upgrade", (request: IncomingMessage, socket: Socket) => {
		const accept = createHash("sha1").update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
		socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
		const frame = (op: number, data: Buffer) => {
			const head = data.length < 126 ? Buffer.from([0x80 | op, data.length]) : Buffer.from([0x80 | op, 126, data.length >> 8, data.length & 255]);
			if (!socket.destroyed) socket.write(Buffer.concat([head, data]));
		};
		const code = (value: number) => Buffer.from([value >> 8, value & 255]);
		const connection: Connection = {
			url: request.url ?? "",
			got: [],
			send: (payload) => frame(1, Buffer.from(JSON.stringify(payload))),
			close: (value) => frame(8, code(value)),
		};
		connections.push(connection);
		const dispatch = (t: string, d: unknown) => connection.send({ op: 0, d, s: ++seq, t });
		let buffer = Buffer.alloc(0);
		socket.on("data", (chunk: Buffer) => {
			buffer = Buffer.concat([buffer, chunk]);
			for (;;) {
				if (buffer.length < 2) return;
				const [first = 0, second = 0] = buffer;
				let [length, at] = [second & 127, 2];
				if (length === 126) [length, at] = [buffer.readUInt16BE(2), 4];
				else if (length === 127) [length, at] = [Number(buffer.readBigUInt64BE(2)), 10];
				if (buffer.length < at + 4 + length) return;
				const mask = buffer.subarray(at, at + 4);
				const data = Buffer.from(buffer.subarray(at + 4, at + 4 + length).map((byte, index) => byte ^ (mask[index % 4] ?? 0)));
				buffer = buffer.subarray(at + 4 + length);
				if ((first & 15) === 8) {
					connection.closed ??= data.length >= 2 ? data.readUInt16BE(0) : 1005;
					frame(8, data.subarray(0, 2));
					socket.end();
					return;
				}
				if ((first & 15) !== 1) continue;
				const payload = JSON.parse(data.toString("utf8")) as { op: number; d: Readonly<Record<string, unknown>> };
				connection.got.push(payload);
				if (payload.op === 1 && api.unacked > 0) api.unacked--;
				else if (payload.op === 1) connection.send({ op: 11, d: null, s: null, t: null });
				if (payload.op === 2 && payload.d.token !== TOKEN && payload.d.token !== SECOND) connection.close(4004);
				else if (payload.op === 2 && api.refuse !== undefined) connection.close(api.refuse);
				else if (payload.op === 2) {
					seq = 0;
					dispatch("READY", { v: 10, user: user(BOT, "arthur", true), guilds: [{ id: GUILD, unavailable: true }], session_id: `session-${++session}`, resume_gateway_url: `ws://127.0.0.1:${port}/resume`, application: { id: BOT, flags: api.flags } });
					dispatch("GUILD_CREATE", { ...guild(2, 1), joined_at: "2026-10-30T10:00:00.000000+00:00", large: false, member_count: 2, voice_states: [], members: [], channels: [channel(MAIN, 0, "arthur"), channel(PROJECT, 0, "shop"), channel("1300000000000000005", 2, "voice")], threads: [], presences: [], stage_instances: [], guild_scheduled_events: [], soundboard_sounds: [] });
				} else if (payload.op === 6) dispatch("RESUMED", null);
			}
		});
		socket.on("error", () => {});
		connection.send({ op: 10, d: { heartbeat_interval: api.heartbeat }, s: null, t: null });
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const port = (server.address() as AddressInfo).port;
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	let id = 0;
	const api = {
		url: `http://127.0.0.1:${port}`,
		calls,
		took,
		connections,
		history: [] as FakeMessage[],
		extra: [] as string[],
		// How many heartbeats from now on get no ACK.
		unacked: 0,
		heartbeat: 45_000,
		remaining: 999,
		resetAfter: 14_400_000,
		flags: 1 << 19,
		members: 2,
		mfa: 1,
		refuse: undefined as number | undefined,
		gatewayUrl: undefined as string | undefined,
		// Every payload the plugin sent of op `op`, across connections.
		sent: (op: number) => connections.flatMap((each) => each.got.filter((payload) => payload.op === op)),
		dispatch: (t: string, d: unknown) => connections.at(-1)?.send({ op: 0, d, s: ++seq, t }),
		send: (payload: unknown) => connections.at(-1)?.send(payload),
		drop: (code: number) => connections.at(-1)?.close(code),
		// The owner's message `fields` change, dispatched as MESSAGE_CREATE; its id is of 5 s before NOW, after every earlier one.
		message(fields: Readonly<Record<string, unknown>> = {}) {
			const sent = message(snowflake(NOW.getTime() - 5000, ++id), fields);
			api.dispatch("MESSAGE_CREATE", sent);
			return sent;
		},
		fail: (call: string, status: number, body: unknown) => void failures.push({ call, status, body }),
	};
	return api;
}

// The plugin on a fake host, with `coordinator.silent` holding what `held` says, its console.error lines kept; `folder` stands for
// the plugin's folder, so a second load shares the first one's outbox, as a restart does.
export async function load(t: TestContext, options: Partial<DiscordOptions> & { readonly apiUrl: string }, setup: { readonly held?: (notice: unknown) => boolean; readonly env?: Readonly<Record<string, string>>; readonly folder?: string } = {}) {
	const errors: string[] = [];
	t.mock.method(console, "error", (text: string) => void errors.push(text));
	const full = { bots: [{ tokenEnv: "ARTHUR_DISCORD_BOT_TOKEN", guildIdEnv: "ARTHUR_DISCORD_GUILD_ID", userIdEnv: "ARTHUR_DISCORD_USER_ID", channelIdEnv: "ARTHUR_DISCORD_CHANNEL_ID" }], ...options };
	const env = setup.env ?? { ARTHUR_DISCORD_BOT_TOKEN: TOKEN, ARTHUR_DISCORD_GUILD_ID: GUILD, ARTHUR_DISCORD_USER_ID: OWNER, ARTHUR_DISCORD_CHANNEL_ID: MAIN };
	const fake = fakeHost({ name: "discord", options: full, env, timeZone: "Europe/Warsaw", quietHours: { from: "22:00", to: "07:30" }, now: NOW });
	const asked: unknown[] = [];
	fake.provide("coordinator.silent", (notice: unknown) => {
		asked.push(notice);
		return setup.held?.(notice) ?? false;
	});
	const plugin = discord(full as DiscordOptions);
	const folder = setup.folder ?? fake.host.folder;
	await (setup.folder === undefined ? fake.setup(plugin) : plugin.setup({ ...fake.host, folder }));
	t.after(() => plugin.stop?.());
	const queued = (box = "") => (existsSync(join(folder, "outbox", box)) ? readdirSync(join(folder, "outbox", box)).filter((name) => name.endsWith(".json")) : []);
	const notices = () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text);
	return { fake, plugin, errors, asked, folder, queued, notices, received: () => fake.emitted.filter((event) => event.name === "message-received").map((event) => event.data) };
}

// A message of one text, as the channel emits it.
export const said = (text: string) => [{ kind: "text", text, mime: "text/plain" }];

import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, readdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { type DiscordOptions, discord } from "../src/discord.ts";

// The fake Discord the discord tests share, REST API, CDN and gateway on one loopback port, and the plugin loaded on a fake host
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
const channel = (id: string, type: number, name: string, guild = GUILD) => ({ id, type, guild_id: guild, position: 0, permission_overwrites: [], name, nsfw: false, parent_id: null, flags: 0, ...(type === 0 ? { topic: null, last_message_id: null, rate_limit_per_user: 0 } : {}) });
// A text channel of another server the bot is in, which `GET /channels/{id}` answers.
export const FOREIGN = "1300000000000000088";
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
// A command or option as Discord's documentation allows one: a name of 1 to 32 lowercase letters, digits, - and _, a description of 1 to 100.
const named = (each: Readonly<Record<string, unknown>>) => typeof each.name === "string" && /^[-_\p{Ll}\p{N}]{1,32}$/u.test(each.name) && typeof each.description === "string" && each.description.length >= 1 && each.description.length <= 100;
const valid = (body: unknown) =>
	Array.isArray(body) && body.length <= 100 && body.every((each) => named(each) && [undefined, 1].includes(each.type) && (each.options ?? []).length <= 25 && (each.options ?? []).every((one: Readonly<Record<string, unknown>>) => named(one) && Number.isInteger(one.type) && [undefined, true, false].includes(one.required as boolean)));

export type FakeMessage = { readonly id: string; readonly channel_id: string } & Readonly<Record<string, unknown>>;
export type Call = { readonly method: string; readonly path: string; readonly headers: IncomingMessage["headers"]; readonly body: unknown; readonly at: number };
// A file of a multipart message Discord took: its form field, its file name and its bytes as text.
export type Upload = { readonly field: string; readonly filename: string; readonly text: string };
type Connection = { readonly url: string; readonly got: Readonly<Record<string, unknown>>[]; closed?: number; send(payload: unknown): void; close(code: number): void };

// The fake on a loopback port the OS picks. The gateway sends Hello, answers Identify with READY and GUILD_CREATE (a wrong token
// with 4004), Resume with RESUMED and each heartbeat with its ACK but the next `unacked`; `dispatch` sends an event, `drop` closes
// from Discord's side. REST answers what the documentation shows; `fail` scripts the next answer of a call, `history` is what
// `GET /channels/{id}/messages` reads. `took` is every message Discord took, a multipart one (`payload_json`, `files[n]`) with
// its `files`. The CDN, under `/attachments/`, asks no token and serves what `attach` put there, else 404. `commands` are the
// server's guild commands, which a valid PUT replaces; `interaction` dispatches a picked command, whose one answer lands in
// `callbacks` (a second, or one for no dispatched interaction, is refused) and whose follow-ups in `followups`.
export async function fakeDiscord(t: TestContext) {
	const calls: Call[] = [];
	const took: { channel: string; body: Readonly<Record<string, unknown>>; files?: Upload[] }[] = [];
	// What the CDN serves by path; null sends the first bytes and holds the rest, as a slow download, until `attach` puts
	// bytes at that path; `held` are those downloads.
	const cdn = new Map<string, Buffer | null>();
	const held: { path: string; response: ServerResponse }[] = [];
	const connections: Connection[] = [];
	const failures: { call: string; status: number; body: unknown }[] = [];
	const callbacks: { id: string; token: string; body: Readonly<Record<string, unknown>> }[] = [];
	const followups: { token: string; body: Readonly<Record<string, unknown>> }[] = [];
	// The token of each interaction dispatched, by its id; the ids of those answered.
	const [open, answered] = [new Map<string, string>(), new Set<string>()];
	let [session, seq] = [0, 0];
	const json = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const server = createServer(async (request, response) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(chunk as Buffer);
		const url = new URL(request.url ?? "/", "http://fake");
		const type = String(request.headers["content-type"] ?? "");
		const form = type.startsWith("multipart/form-data") ? await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData() : undefined;
		const body = form !== undefined ? JSON.parse(String(form.get("payload_json") ?? "{}")) : chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
		calls.push({ method: request.method ?? "", path: `${url.pathname}${url.search}`, headers: request.headers, body, at: Date.now() });
		const call = `${request.method} ${url.pathname}`;
		if (url.pathname.startsWith("/attachments/")) {
			const bytes = cdn.get(url.pathname);
			if (bytes === null) {
				response.writeHead(200, { "Content-Type": "application/octet-stream" }).write("first bytes");
				return void held.push({ path: url.pathname, response });
			}
			return bytes === undefined ? response.writeHead(404, { "Content-Type": "text/plain" }).end("This content is no longer available.") : response.writeHead(200, { "Content-Type": "application/octet-stream" }).end(bytes);
		}
		if (![TOKEN, SECOND].map((token) => `Bot ${token}`).includes(String(request.headers.authorization))) return json(response, 401, { message: "401: Unauthorized", code: 0 });
		const failure = failures.findIndex((each) => each.call === call);
		if (failure >= 0) {
			const [{ status, body: answer } = { status: 500, body: {} }] = failures.splice(failure, 1);
			return json(response, status, answer);
		}
		if (call === "GET /gateway/bot") return json(response, 200, { url: api.gatewayUrl ?? `ws://127.0.0.1:${port}`, shards: 1, session_start_limit: { total: 1000, remaining: api.remaining, reset_after: api.resetAfter, max_concurrency: 1 } });
		if (call === "GET /applications/@me") return json(response, 200, application(api.flags));
		if (call === `GET /guilds/${GUILD}`) return json(response, 200, guild(api.members, api.mfa));
		const lookup = request.method === "GET" ? /^\/channels\/(\d+)$/.exec(url.pathname)?.[1] : undefined;
		if (lookup === FOREIGN) return json(response, 200, channel(FOREIGN, 0, "elsewhere", "1100000000000000999"));
		if (lookup !== undefined) return [MAIN, PROJECT].includes(lookup) ? json(response, 200, channel(lookup, 0, "arthur")) : json(response, 404, { message: "Unknown Channel", code: 10003 });
		const id = /^\/channels\/(\d+)\/messages$/.exec(url.pathname)?.[1];
		if (id !== undefined && ![MAIN, PROJECT, ...api.extra].includes(id)) return json(response, 404, { message: "Unknown Channel", code: 10003 });
		// Discord refuses a message's content over 2000 characters, a channel's message and an interaction's follow-up alike.
		const long = typeof body?.content === "string" && body.content.length > 2000;
		const tooLong = { message: "Invalid Form Body", code: 50035, errors: { content: { _errors: [{ code: "BASE_TYPE_MAX_LENGTH", message: "Must be 2000 or fewer in length." }] } } };
		if (id !== undefined && request.method === "POST") {
			if (long) return json(response, 400, tooLong);
			// Discord's files are the fields files[n], each named in payload_json's attachments by its n.
			const files = form === undefined ? [] : [...form.entries()].filter(([field]) => field !== "payload_json");
			const named = Array.isArray(body.attachments) ? (body.attachments as { id: unknown }[]).map((each) => `files[${String(each.id)}]`) : [];
			if (files.some(([field, value]) => !/^files\[\d+\]$/.test(field) || typeof value === "string" || !named.includes(field)))
				return json(response, 400, { message: "Invalid Form Body", code: 50035, errors: { files: { _errors: [{ code: "BASE_TYPE_REQUIRED", message: "This field is required" }] } } });
			const uploads = await Promise.all(files.map(async ([field, value]) => ({ field, filename: (value as File).name, text: await (value as File).text() })));
			took.push({ channel: id, body, ...(form === undefined ? {} : { files: uploads }) });
			const attachments = uploads.map((each, at) => ({ id: snowflake(Date.now(), at), filename: each.filename, size: Buffer.byteLength(each.text), url: `${api.url}/attachments/${id}/${at}/${each.filename}`, proxy_url: `${api.url}/attachments/${id}/${at}/${each.filename}` }));
			return json(response, 200, message(snowflake(Date.now()), { channel_id: id, guild_id: undefined, author: user(BOT, "arthur", true), content: body.content ?? "", flags: body.flags ?? 0, attachments }));
		}
		if (id !== undefined && request.method === "GET") {
			const since = BigInt(url.searchParams.get("after") ?? "0");
			return json(response, 200, api.history.filter((each) => each.channel_id === id && BigInt(each.id) > since).map(({ guild_id: _, ...each }) => each).toSorted((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1)).slice(0, Number(url.searchParams.get("limit") ?? 50)));
		}
		if (call === `GET /applications/${BOT}/guilds/${GUILD}/commands`) return json(response, 200, api.commands);
		if (call === `PUT /applications/${BOT}/guilds/${GUILD}/commands`) {
			if (!valid(body)) return json(response, 400, { message: "Invalid Form Body", code: 50035, errors: { _errors: [{ code: "BASE_TYPE_BAD_LENGTH", message: "Must be between 1 and 100 in length." }] } });
			api.commands = (body as Readonly<Record<string, unknown>>[]).map((each, at) => ({ id: snowflake(NOW.getTime(), at), application_id: BOT, version: snowflake(NOW.getTime(), 100 + at), default_member_permissions: null, type: 1, name: each.name, name_localizations: null, description: each.description, description_localizations: null, guild_id: GUILD, options: each.options ?? [], nsfw: false }));
			return json(response, 200, api.commands);
		}
		const answer = /^\/interactions\/(\d+)\/([^/]+)\/callback$/.exec(url.pathname);
		if (answer !== null && request.method === "POST") {
			const [, id = "", token = ""] = answer;
			if (answered.has(id)) return json(response, 400, { message: "Interaction has already been acknowledged.", code: 40060 });
			if (open.get(id) !== token) return json(response, 404, { message: "Unknown interaction", code: 10062 });
			answered.add(id);
			callbacks.push({ id, token, body });
			return void response.writeHead(204).end();
		}
		const webhook = new RegExp(`^/webhooks/${BOT}/([^/]+)$`).exec(url.pathname)?.[1];
		if (webhook !== undefined && request.method === "POST") {
			if (![...open.values()].includes(webhook)) return json(response, 404, { message: "Unknown Webhook", code: 10015 });
			if (long) return json(response, 400, tooLong);
			followups.push({ token: webhook, body });
			return json(response, 200, message(snowflake(Date.now()), { channel_id: MAIN, guild_id: undefined, author: user(BOT, "arthur", true), content: body.content ?? "", flags: 0, webhook_id: BOT, application_id: BOT, type: 20 }));
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
		callbacks,
		followups,
		commands: [] as Readonly<Record<string, unknown>>[],
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
		// An attachment as the gateway gives one, `bytes` on the CDN behind its signed link (null: held until a later `attach`
		// of the same id and name gives its bytes); `fields` change it, as `content_type`.
		attach(id: string, filename: string, bytes: string | null, fields: Readonly<Record<string, unknown>> = {}) {
			const path = `/attachments/${MAIN}/${id}/${encodeURIComponent(filename)}`;
			cdn.set(path, bytes === null ? null : Buffer.from(bytes));
			if (bytes !== null) for (const each of held.filter((one) => one.path === path)) each.response.end(bytes);
			const signed = `?ex=6724a000&is=67234e80&hm=${"0f".repeat(32)}&`;
			return { id, filename, size: Buffer.byteLength(bytes ?? ""), url: `${api.url}${path}${signed}`, proxy_url: `${api.url}${path.replace("attachments", "media")}${signed}`, ...fields };
		},
		// The owner picking `/name` with `text` as its option (none when undefined) in the main channel, dispatched as
		// INTERACTION_CREATE in the documented shape; `fields` change it, as `member` or `channel_id`.
		interaction(name: string, text?: string, fields: Readonly<Record<string, unknown>> = {}) {
			const sent = {
				id: snowflake(NOW.getTime(), 500 + ++id), application_id: BOT, type: 2, guild_id: GUILD, channel_id: MAIN, token: `aW50ZXJhY3Rpb246${id}${"Q".repeat(40)}`, version: 1,
				data: { id: snowflake(NOW.getTime(), 900), name, type: 1, guild_id: GUILD, ...(text === undefined ? {} : { options: [{ name: "text", type: 3, value: text }] }) },
				member: { user: user(OWNER, "kacper"), nick: null, avatar: null, roles: [], joined_at: "2026-10-30T10:00:00.000000+00:00", premium_since: null, deaf: false, mute: false, flags: 0, pending: false, permissions: "2251799813685247" },
				app_permissions: "2251799813685247", locale: "en-US", guild_locale: "en-US", entitlements: [], authorizing_integration_owners: { "0": GUILD }, context: 0, attachment_size_limit: 10_485_760, ...fields,
			};
			open.set(sent.id, sent.token);
			api.dispatch("INTERACTION_CREATE", sent);
			return sent;
		},
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

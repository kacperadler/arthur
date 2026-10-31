import { setTimeout as sleep } from "node:timers/promises";
import { type ApiError, type Bot, rest } from "./rest.ts";

// One bot's connection to Discord's gateway (spec/roadmap.md, entry 89), outbound over Node's own WebSocket, so nothing listens:
// Hello, a heartbeat every interval (the first after a random part of it), Identify with the GUILDS, GUILD_MESSAGES and
// MESSAGE_CONTENT intents and no other, then each dispatch to `on`. A drop resumes the session through `resume_gateway_url`: a
// heartbeat not acknowledged before the next (the socket closed with 4000, which keeps the session), op 7 and any close but
// 4007 and 4009, which start a new session, as op 9 does unless its `d` is true, after 1 to 5 s. A connection that never
// got to READY or RESUMED waits before the next, from 1 s doubling to 60 s. A new session asks `GET /gateway/bot` first and
// does not identify while fewer than 50 of Discord's session starts are left (Discord resets the token after 1000 in a day),
// until they reset. A close Discord says not to retry (4004, 4010 to 4014), or a gateway address that is not wss: (ws: only on
// loopback, for a test), ends it, said once by `fatal`; a stop closes with 1000: packages/discord/docs/discord.md, "Receiving".

// GUILDS (1 << 0), GUILD_MESSAGES (1 << 9), MESSAGE_CONTENT (1 << 15).
export const INTENTS = 33281;
const FLOOR = 50;
const FIRST_MS = 1000;
const MOST_MS = 60_000;
const PORTAL = "the Bot page of the application at discord.com/developers/applications";

const FATAL = (bot: Bot, code: number) =>
	({
		4004: `Discord refused the token in ${bot.tokenEnv} (4004 Authentication failed): reset it on ${PORTAL}, put the new one in ${bot.tokenEnv} and restart Arthur`,
		4010: "Discord refused the shard sent (4010 Invalid shard)",
		4011: "Discord asks for sharding (4011 Sharding required), which a bot on one server never needs",
		4012: "Discord refused the gateway version, v10 (4012 Invalid API version)",
		4013: `Discord refused the intents ${INTENTS} (4013 Invalid intents)`,
		4014: `Discord refused the MESSAGE_CONTENT intent (4014 Disallowed intents): switch on Message Content Intent on ${PORTAL} and restart Arthur`,
	})[code];

type Payload = { readonly op?: unknown; readonly d?: unknown; readonly s?: unknown; readonly t?: unknown };
const record = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;
const secure = (url: URL | null) => url?.protocol === "wss:" || (url?.protocol === "ws:" && /^(localhost|127(\.\d+){3}|\[::1\])$/.test(url.hostname));

export async function gateway(bot: Bot, signal: AbortSignal, on: (type: string, data: Readonly<Record<string, unknown>>) => void, fatal: (line: string) => void): Promise<void> {
	const name = `discord bot ${bot.label}`;
	let session: { readonly id: string; readonly url: string } | undefined;
	let seq: number | null = null;
	let wait = FIRST_MS;
	let said = "";
	const say = (line: string) => {
		if (said !== line) console.error(line);
		said = line;
	};
	const pause = (ms: number) => sleep(ms, undefined, { signal }).catch(() => undefined);
	while (!signal.aborted) {
		let url = session?.url;
		if (url === undefined) {
			let found: Readonly<Record<string, unknown>>;
			try {
				found = record(await rest(bot, "GET", "/gateway/bot", undefined, signal));
			} catch (error) {
				if (signal.aborted) return;
				const { message, retryAfter } = error as ApiError;
				const ms = Math.max(wait, retryAfter * 1000);
				say(`${message}; the gateway connects again in ${ms / 1000} s`);
				await pause(ms);
				wait = Math.min(wait * 2, MOST_MS);
				continue;
			}
			const { remaining, reset_after: reset } = record(found.session_start_limit);
			if (typeof remaining === "number" && remaining < FLOOR) {
				const ms = typeof reset === "number" && reset > 0 ? reset : MOST_MS;
				say(`${name}: only ${remaining} of Discord's daily session starts are left, and at none Discord resets the token; the bot connects again once they reset, in ${Math.ceil(ms / 1000)} s`);
				await pause(ms);
				continue;
			}
			url = String(found.url);
		}
		const address = URL.parse(url);
		if (address === null || !secure(address)) return fatal(`${name}: the gateway address ${JSON.stringify(url)} is not wss:, and the token goes only over an encrypted connection`);
		address.search = "v=10&encoding=json";
		said = "";
		const { code, reached, invalid } = await connect(address);
		if (signal.aborted) return;
		const end = FATAL(bot, code);
		if (end !== undefined) return fatal(`${name}: ${end}`);
		if (code === 4007 || code === 4009 || invalid) [session, seq] = [undefined, null];
		if (invalid) await pause(1000 + Math.random() * 4000);
		else if (!reached) {
			await pause(wait);
			wait = Math.min(wait * 2, MOST_MS);
		}
	}

	// One connection, until it closes: its close code, whether it got to READY or RESUMED, and whether op 9 ended the session.
	function connect(address: URL): Promise<{ code: number; reached: boolean; invalid: boolean }> {
		const { promise, resolve } = Promise.withResolvers<{ code: number; reached: boolean; invalid: boolean }>();
		const socket = new WebSocket(address);
		let [reached, invalid, acked] = [false, false, true];
		let timer: NodeJS.Timeout | undefined;
		const send = (op: number, d: unknown) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ op, d }));
		const beat = () => {
			if (!acked) return socket.close(4000, "no heartbeat ACK");
			acked = false;
			send(1, seq);
		};
		const stop = () => socket.close(1000);
		signal.addEventListener("abort", stop, { once: true });
		socket.addEventListener("message", (event) => {
			let payload: Payload = {};
			try {
				payload = record(JSON.parse(String(event.data)));
			} catch {}
			const { op, d, s, t } = payload;
			if (typeof s === "number") seq = s;
			if (op === 10) {
				const every = Number(record(d).heartbeat_interval);
				timer = setTimeout(() => {
					beat();
					timer = setInterval(beat, every);
				}, every * Math.random());
				if (session === undefined) send(2, { token: bot.token, intents: INTENTS, properties: { os: process.platform, browser: "arthur", device: "arthur" } });
				else send(6, { token: bot.token, session_id: session.id, seq });
			} else if (op === 11) acked = true;
			else if (op === 1) send(1, seq);
			else if (op === 7) socket.close(4000, "reconnect asked");
			else if (op === 9) {
				invalid = d !== true;
				socket.close(4000, "invalid session");
			} else if (op === 0 && typeof t === "string") {
				const data = record(d);
				if (t === "READY") session = { id: String(data.session_id), url: String(data.resume_gateway_url) };
				if (t === "READY" || t === "RESUMED") [reached, wait] = [true, FIRST_MS];
				on(t, data);
			}
		});
		socket.addEventListener("close", (event) => {
			clearTimeout(timer);
			signal.removeEventListener("abort", stop);
			resolve({ code: event.code, reached, invalid });
		});
		return promise;
	}
}

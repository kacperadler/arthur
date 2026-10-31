import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { type Bot, rest } from "./rest.ts";

// What one bot hears through the gateway (spec/roadmap.md, entry 89): the server's text channels, from GUILD_CREATE and the
// CHANNEL_ events, and the owner's messages. A message counts when it is of the bot's server, by the owner (`author.id`), not
// a webhook's, a plain one or a reply: in the main channel it becomes `message-received` `{ channel: "discord", parts,
// instance? }`, in another text channel with that channel's id as `place`; one in a thread, a forum post or a voice channel's
// chat gets a line back in the main channel instead, and so does a sticker or a file, which only text reaches the coordinator
// as yet. One the owner forwarded is marked `[forwarded from <author>]`. An edit is no new message, so it is never heard.
// Each GUILD_CREATE (a new session) also reads what the owner wrote in each text channel since the last message heard there,
// at most 10 minutes back, kept in `<folder>/seen.json`, so what he wrote while Arthur was away comes once: docs/discord.md.

export type Send = (bot: Bot, text: string, place: string | undefined) => void;
// What a bot hears: `known` its server's text channels, undefined until GUILD_CREATE named them; `on` takes each dispatch.
export type Ear = { known(): ReadonlySet<string> | undefined; on(type: string, data: Readonly<Record<string, unknown>>): void };
type Message = Readonly<Record<string, unknown>> & { readonly id?: unknown; readonly channel_id?: unknown; readonly content?: unknown };

const OLDEST_MS = 600_000;
// Discord's epoch, the first millisecond of 2015, from which a snowflake's top 42 bits count.
const EPOCH = 1420070400000n;
export const OTHER = "only text reaches the coordinator through Discord as yet: a file, a photo, a voice message or a sticker is not read";
export const ELSEWHERE = "a message outside the server's text channels (a thread, a forum post, a voice channel's chat) was not read: only the text channels reach Arthur";

const record = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;
const list = (value: unknown) => (Array.isArray(value) ? (value as readonly unknown[]) : []);
const after = (id: unknown, than: string) => typeof id === "string" && /^\d{1,20}$/.test(id) && BigInt(id) > BigInt(than);

export function receiver(host: Host, bot: Bot, send: Send, named: () => void, signal: AbortSignal): Ear {
	let channels: Set<string> | undefined;
	// Messages are handled one after another, a backlog before what came after it.
	let chain = Promise.resolve();
	const file = join(host.folder, "seen.json");
	// The whole file, every bot's: a broken or hand-edited one counts as empty, and is written whole again at the next message.
	const load = () => {
		try {
			return record(JSON.parse(readFileSync(file, "utf8")));
		} catch {
			return {};
		}
	};
	const seen: Record<string, string> = Object.fromEntries(Object.entries(record(load()[bot.name ?? ""])).filter(([, id]) => after(id, "0")) as [string, string][]);
	const keep = (channel: string, id: string) => {
		seen[channel] = id;
		writeFileSync(`${file}.tmp`, JSON.stringify({ ...load(), [bot.name ?? ""]: seen }));
		renameSync(`${file}.tmp`, file);
	};

	const hear = (message: Message, live: boolean) => {
		const channel = String(message.channel_id);
		const author = record(message.author);
		if ((live && message.guild_id !== bot.guild) || author.id !== bot.user || message.webhook_id !== undefined || ![0, 19].includes(Number(message.type))) return;
		if (!after(message.id, seen[channel] ?? "0")) return;
		keep(channel, String(message.id));
		if (channels?.has(channel) !== true) return send(bot, ELSEWHERE, undefined);
		const forward = record(message.message_reference).type === 1;
		const snapshots = list(message.message_snapshots).map((each) => record(record(each).message));
		const texts = [message, ...(forward ? snapshots : [])].map((each) => String(each.content ?? "").trim()).filter((text) => text !== "");
		const files = [message, ...snapshots].some((each) => list(each.attachments).length > 0 || list(each.sticker_items).length > 0);
		const place = channel === bot.channel ? undefined : channel;
		if (files || (texts.length === 0 && !forward)) send(bot, OTHER, place);
		if (texts.length === 0 && !forward) return;
		const text = forward ? [`[forwarded from ${origin(snapshots)}]`, ...texts].join(" ") : texts.join(" ");
		host.events.emit("message-received", { channel: "discord", parts: [{ kind: "text", text, mime: "text/plain" }], ...(place === undefined ? {} : { place }), ...(bot.name === undefined ? {} : { instance: bot.name }) });
	};

	// What the owner wrote in each text channel since the last message heard there, at most 10 minutes back, oldest first.
	const backlog = async (known: ReadonlySet<string>) => {
		const floor = String((BigInt(host.clock.now().getTime() - OLDEST_MS) - EPOCH) << 22n);
		for (const channel of [...known]) {
			const since = after(seen[channel], floor) ? (seen[channel] as string) : floor;
			try {
				const messages = list(await rest(bot, "GET", `/channels/${channel}/messages?after=${since}&limit=100`, undefined, signal)).map(record);
				for (const message of messages.toSorted((a, b) => (after(a.id, String(b.id)) ? 1 : -1))) hear({ ...message, channel_id: channel }, false);
			} catch (error) {
				if (signal.aborted) return;
				console.error(`${(error as Error).message}; what the owner wrote in channel ${channel} while Arthur was away is not read`);
			}
		}
	};

	return {
		known: () => channels,
		on(type: string, data: Readonly<Record<string, unknown>>) {
			if (type === "GUILD_CREATE" && data.id === bot.guild) {
				const known = new Set(list(data.channels).map(record).filter((each) => each.type === 0).map((each) => String(each.id)));
				channels = known;
				named();
				chain = chain.then(() => backlog(known));
			} else if (type.startsWith("CHANNEL_") && data.guild_id === bot.guild && channels !== undefined) {
				if (type !== "CHANNEL_DELETE" && data.type === 0) channels.add(String(data.id));
				else channels.delete(String(data.id));
			} else if (type === "MESSAGE_CREATE") chain = chain.then(() => hear(data, true));
		},
	};
}

// A forwarded message's author, which Discord's snapshot leaves out today, cut of what could close the mark or break or reverse its line.
const origin = (snapshots: readonly Readonly<Record<string, unknown>>[]) => {
	const author = record(snapshots[0]?.author);
	const name = [author.global_name, author.username].map((each) => (typeof each === "string" ? each.replace(/[\p{Cc}\p{Zl}\p{Zp}\p{Cf}\]]/gu, "") : "")).find((each) => each !== "");
	return name ?? "a hidden sender";
};

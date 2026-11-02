import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Host } from "@arthur/core/plugin";
import { attachments } from "./media-in.ts";
import { type Bot, rest } from "./rest.ts";

// What one bot hears through the gateway (spec/roadmap.md, entries 89 and 90): the server's text channels, from GUILD_CREATE and
// the CHANNEL_ events, and the owner's messages. A message counts when it is of the bot's server, by the owner (`author.id`), not
// a webhook's, a plain one or a reply. `/name text` he did not forward and sent without a file is a phone command, routed to the
// host's registry with its channel, place and instance, the reply sent back there. Any other becomes `message-received` `{
// channel: "discord", parts, instance? }`, its files first (media-in.ts), then its text; in another text channel than the main
// one with that channel's id as `place`. One in a thread, a forum post or a voice channel's chat gets a line back in the main
// channel instead; a sticker, or a message of neither text nor files, a line where it came. One the owner forwarded is marked
// `[forwarded from <author>]` and never a command. An edit is no new message, so it is never heard. Each GUILD_CREATE (a new
// session) also reads what the owner wrote in each text channel since the last message heard there, at most 10 minutes back,
// kept in `<folder>/seen.json`, so what he wrote while Arthur was away comes once: docs/discord.md.

export type Send = (bot: Bot, text: string, place: string | undefined) => void;
// What a bot hears: `known` its server's text channels, undefined until GUILD_CREATE named them; `on` takes each dispatch;
// `idle` is the end of the messages in hand.
export type Ear = { known(): ReadonlySet<string> | undefined; on(type: string, data: Readonly<Record<string, unknown>>): void; idle(): Promise<void> };
type Message = Readonly<Record<string, unknown>> & { readonly id?: unknown; readonly channel_id?: unknown; readonly content?: unknown };

const OLDEST_MS = 600_000;
// Discord's epoch, the first millisecond of 2015, from which a snowflake's top 42 bits count.
const EPOCH = 1420070400000n;
export const OTHER = "only text, photos, videos, voice messages, audio and files reach the coordinator: a sticker is not read";
export const ELSEWHERE = "a message outside the server's text channels (a thread, a forum post, a voice channel's chat) was not read: only the text channels reach Arthur";

const record = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;
const list = (value: unknown) => (Array.isArray(value) ? (value as readonly unknown[]) : []);
const after = (id: unknown, than: string) => typeof id === "string" && /^\d{1,20}$/.test(id) && BigInt(id) > BigInt(than);
// A phone command: 1 to 32 letters, digits and underscores after the slash, then a space, a line break or the end.
const COMMAND = /^\/(\w{1,32})(?=\s|$)/;

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

	const hear = async (message: Message, live: boolean) => {
		const channel = String(message.channel_id);
		const author = record(message.author);
		if ((live && message.guild_id !== bot.guild) || author.id !== bot.user || message.webhook_id !== undefined || ![0, 19].includes(Number(message.type))) return;
		if (channels?.has(channel) !== true) return send(bot, ELSEWHERE, undefined);
		if (!after(message.id, seen[channel] ?? "0")) return;
		const forward = record(message.message_reference).type === 1;
		const sources = [message, ...(forward ? list(message.message_snapshots).map((each) => record(record(each).message)) : [])];
		const texts = sources.map((each) => String(each.content ?? "").trim()).filter((text) => text !== "");
		const place = channel === bot.channel ? undefined : channel;
		const from = { channel: "discord", ...(place === undefined ? {} : { place }), ...(bot.name === undefined ? {} : { instance: bot.name }) };
		// Saved before the message counts as heard, so one a stop cut short is read again at the next start.
		const files = await attachments(host.folder, sources, signal);
		if (signal.aborted) return;
		keep(channel, String(message.id));
		const command = forward || files.length > 0 || typeof message.content !== "string" ? null : COMMAND.exec(message.content);
		if (command !== null) return send(bot, await host.commands.route(`/${command[1]}${command.input.slice(command[0].length)}`, from), place);
		const nothing = texts.length === 0 && files.length === 0 && !forward;
		if (nothing || sources.some((each) => list(each.sticker_items).length > 0)) send(bot, OTHER, place);
		if (nothing) return;
		const text = forward ? [`[forwarded from ${origin(sources.slice(1))}]`, ...texts].join(" ") : texts.join(" ");
		host.events.emit("message-received", { ...from, parts: [...files, ...(text === "" ? [] : [{ kind: "text", text, mime: "text/plain" }])] });
	};

	// What the owner wrote in each text channel since the last message heard there, at most 10 minutes back, oldest first.
	const backlog = async (known: ReadonlySet<string>) => {
		const floor = String((BigInt(host.clock.now().getTime() - OLDEST_MS) - EPOCH) << 22n);
		for (const channel of [...known]) {
			const since = after(seen[channel], floor) ? (seen[channel] as string) : floor;
			try {
				const messages = list(await rest(bot, "GET", `/channels/${channel}/messages?after=${since}&limit=100`, undefined, signal)).map(record);
				for (const message of messages.toSorted((a, b) => (after(a.id, String(b.id)) ? 1 : -1))) await hear({ ...message, channel_id: channel }, false);
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
			} else if (type === "MESSAGE_CREATE") {
				// A message that fails (its seen.json not written) is said and dropped; those after it are still heard.
				chain = chain
					.then(() => hear(data, true))
					.catch((error: Error) => console.error(`discord bot ${bot.label}: message ${String(data.id)} is not read: ${error.message}`));
			}
		},
		idle: () => chain,
	};
}

// A forwarded message's author, which Discord's snapshot leaves out today, cut of what could close the mark or break or reverse its line.
const origin = (snapshots: readonly Readonly<Record<string, unknown>>[]) => {
	const author = record(snapshots[0]?.author);
	const name = [author.global_name, author.username].map((each) => (typeof each === "string" ? each.replace(/[\p{Cc}\p{Zl}\p{Zp}\p{Cf}\]]/gu, "") : "")).find((each) => each !== "");
	return name ?? "a hidden sender";
};

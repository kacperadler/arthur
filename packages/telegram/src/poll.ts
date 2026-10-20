import { setTimeout as sleep } from "node:timers/promises";
import type { Host } from "@arthur/core/plugin";
import { type ApiError, type Bot, call } from "./bot-api.ts";
import { type Message, parts } from "./media-in.ts";

// One bot's long polling (spec/roadmap.md, entries 47 to 49): `getUpdates` waiting up to 30 s, each update confirmed by the
// next call's `offset`. A message of the bot's own chat, at most 10 minutes old, is the owner's: what it holds becomes the parts
// of `message-received` `{ channel: "telegram", parts, place?, instance? }` (media-in.ts), `instance` the name of a named bot
// (AR0211); an album, several messages, is one, sent once a poll of 1 s brings no more of it, and the messages after it wait for
// it; any other kind of message gets a line back. A message of any other chat is dropped unanswered. A failed call is said once
// until a call answers, and polling goes on after 2 s (a 429: its retry_after); a call that answers sends the outbox
// (`answered`), so what waits there goes once Telegram is back: packages/telegram/docs/telegram.md, "Receiving".

export type Send = (bot: Bot, text: string, place: string | undefined) => void;

const WAIT_S = 30;
const ALBUM_WAIT_S = 1;
const RETRY_MS = 2000;
const OLDEST_S = 600;
export const OTHER = "only text, photos, videos, voice notes, audio and files reach the coordinator";

export async function poll(host: Host, bot: Bot, signal: AbortSignal, send: Send, answered: () => void): Promise<void> {
	let offset = 0;
	let said = "";
	// The owner's messages not sent yet, in order, an album's together: the first album a poll still brought more of stops them.
	const pending: { readonly album?: string; readonly messages: Message[] }[] = [];
	while (!signal.aborted) {
		let updates: unknown;
		try {
			const timeout = pending.length > 0 ? ALBUM_WAIT_S : WAIT_S;
			updates = await call(bot, "getUpdates", { offset, timeout, allowed_updates: ["message"] }, AbortSignal.any([signal, AbortSignal.timeout((timeout + 10) * 1000)]));
		} catch (error) {
			if (signal.aborted) return;
			const { code, message, retryAfter } = error as ApiError;
			// A 429 says how long to wait; a second poller of the same token answers 409 to every call, one notice for the stretch.
			const wait = Math.max(RETRY_MS, retryAfter * 1000);
			const kind = code === 409 ? "409" : message;
			if (said !== kind && code === 409) host.events.emit("notice", { text: `${message}; until it ends, nothing written to this bot reaches the coordinator; polling retries every ${RETRY_MS / 1000} s` });
			else if (said !== kind) console.error(`${message}; polling retries in ${wait / 1000} s`);
			said = kind;
			await sleep(wait, undefined, { signal }).catch(() => undefined);
			continue;
		}
		said = "";
		answered();
		const grown = new Set<string>();
		for (const update of Array.isArray(updates) ? (updates as readonly { readonly update_id?: unknown; readonly message?: Message }[]) : []) {
			if (typeof update.update_id === "number") offset = Math.max(offset, update.update_id + 1);
			const message = update.message;
			if (message?.chat?.id !== bot.chat || typeof message.date !== "number" || host.clock.now().getTime() / 1000 - message.date > OLDEST_S) continue;
			const album = typeof message.media_group_id === "string" ? message.media_group_id : undefined;
			const group = album === undefined ? undefined : pending.find((each) => each.album === album);
			if (group === undefined) pending.push({ ...(album === undefined ? {} : { album }), messages: [message] });
			else group.messages.push(message);
			if (album !== undefined) grown.add(album);
		}
		for (let first = pending[0]; first !== undefined && !grown.has(first.album ?? ""); first = pending[0]) {
			pending.shift();
			// A stop during a download drops the message; its update was not confirmed, so the next start gets it again.
			await receive(host, bot, first.messages, send, signal).catch((error: unknown) => {
				if (!signal.aborted) throw error;
			});
		}
	}
}

async function receive(host: Host, bot: Bot, messages: readonly Message[], send: Send, signal: AbortSignal): Promise<void> {
	const [{ message_thread_id: thread, is_topic_message: inTopic } = {}] = messages;
	const place = inTopic === true && typeof thread === "number" ? String(thread) : undefined;
	const found = await parts(bot, host.folder, messages, signal);
	if (found.length === 0) return send(bot, OTHER, place);
	host.events.emit("message-received", { channel: "telegram", parts: found, ...(place === undefined ? {} : { place }), ...(bot.name === undefined ? {} : { instance: bot.name }) });
}

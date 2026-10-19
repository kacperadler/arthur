import { setTimeout as sleep } from "node:timers/promises";
import type { Host } from "@arthur/core/plugin";
import { type ApiError, type Bot, call } from "./bot-api.ts";

// One bot's long polling (spec/roadmap.md, entries 47 and 48): `getUpdates` waiting up to 30 s, each update confirmed by the
// next call's `offset`. A message of the bot's own chat, at most 10 minutes old, is the owner's: its text becomes
// `message-received` `{ channel: "telegram", text, place?, instance? }`, `instance` the name of a named bot (AR0211); any other
// kind of message gets a line back. A message of any other chat is dropped unanswered. A failed call is said once until a call
// answers, and polling goes on after 2 s (a 429: its retry_after); a call that answers sends the outbox (`answered`), so what
// waits there goes once Telegram is back: packages/telegram/docs/telegram.md, "Receiving".

export type Send = (bot: Bot, text: string, place: string | undefined) => void;

const WAIT_S = 30;
const RETRY_MS = 2000;
const OLDEST_S = 600;
export const OTHER = "only text, photos and files reach the coordinator";

type Message = {
	readonly chat?: { readonly id?: unknown };
	readonly date?: unknown;
	readonly text?: unknown;
	readonly message_thread_id?: unknown;
	readonly is_topic_message?: unknown;
};

export async function poll(host: Host, bot: Bot, signal: AbortSignal, send: Send, answered: () => void): Promise<void> {
	let offset = 0;
	let said = "";
	while (!signal.aborted) {
		let updates: unknown;
		try {
			updates = await call(bot, "getUpdates", { offset, timeout: WAIT_S, allowed_updates: ["message"] }, AbortSignal.any([signal, AbortSignal.timeout((WAIT_S + 10) * 1000)]));
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
		for (const update of Array.isArray(updates) ? (updates as readonly { readonly update_id?: unknown; readonly message?: Message }[]) : []) {
			if (typeof update.update_id === "number") offset = Math.max(offset, update.update_id + 1);
			if (update.message !== undefined) receive(host, bot, update.message, send);
		}
	}
}

function receive(host: Host, bot: Bot, message: Message, send: Send): void {
	if (message.chat?.id !== bot.chat) return;
	if (typeof message.date !== "number" || host.clock.now().getTime() / 1000 - message.date > OLDEST_S) return;
	const place = message.is_topic_message === true && typeof message.message_thread_id === "number" ? String(message.message_thread_id) : undefined;
	if (typeof message.text === "string") host.events.emit("message-received", { channel: "telegram", text: message.text, ...(place === undefined ? {} : { place }), ...(bot.name === undefined ? {} : { instance: bot.name }) });
	else send(bot, OTHER, place);
}

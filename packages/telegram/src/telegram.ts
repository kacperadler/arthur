import type { Plugin } from "@arthur/core/plugin";
import { type Bot, call } from "./bot-api.ts";
import { poll, type Send } from "./poll.ts";
import { slices } from "./slices.ts";
import { checkOptions } from "./telegram-options.ts";

// The telegram plugin (spec/roadmap.md, entry 47): bots as instances, named and unnamed, each polling its one chat (poll.ts);
// the coordinator's replies and the notices sent by the unnamed bot, else the first, in slices of one message, without a
// notification in quiet hours, and a notice only when `call("coordinator.silent", notice)` does not hold it:
// packages/telegram/docs/telegram.md. Only `arthur run` starts the plugin, so only it polls and sends; what comes before the
// start, as the replay of the event log, is sent at the start.

export type BotOptions = { readonly name?: string; readonly botTokenEnv: string; readonly chatIdEnv: string };

export type TelegramOptions = { readonly enabled?: boolean; readonly bots: readonly BotOptions[]; readonly apiUrl?: string };

const MESSAGE = 4096;
const SEND_MS = 30_000;

const asRecord = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;
// A place is a topic's `message_thread_id`; any other is not Telegram's, and the message goes to the chat itself.
const topic = (place: unknown) => (typeof place === "string" && /^[1-9]\d{0,15}$/.test(place) ? place : undefined);

export function telegram(options: TelegramOptions): Plugin {
	const gate = Promise.withResolvers<void>();
	// Every send, one after another, from the start on.
	let sending = gate.promise;
	let polling = () => [] as Promise<void>[];
	let polls: Promise<void>[] = [];
	let started = false;
	const stopping = new AbortController();
	return {
		name: "telegram",
		options,
		check: checkOptions,
		setup(host) {
			const { bots: listed, apiUrl = "https://api.telegram.org" } = host.options as TelegramOptions;
			const bots = listed.map((each, index) => bot(host.env, each, index, apiUrl.replace(/\/+$/, "")));
			const main = bots[Math.max(0, listed.findIndex((each) => each.name === undefined))] as Bot;
			const send: Send = (to, text, place) => {
				sending = sending.then(async () => {
					for (const slice of slices(text, MESSAGE)) {
						const message = { chat_id: to.chat, text: slice, disable_notification: host.clock.isQuiet(), ...(place === undefined ? {} : { message_thread_id: Number(place) }) };
						await call(to, "sendMessage", message, AbortSignal.timeout(SEND_MS)).catch((error: Error) => console.error(`${error.message}; a slice of ${slice.length} characters was not sent`));
					}
				});
			};
			host.events.on("coordinator-replied", (event) => {
				const { text, channels, place } = asRecord(event.data);
				if (typeof text === "string" && (!Array.isArray(channels) || channels.length === 0 || channels.includes("telegram"))) send(main, text, topic(place));
			});
			host.events.on("notice", (event) => {
				const { text, place } = asRecord(event.data);
				if (typeof text === "string" && host.call<boolean>("coordinator.silent", event.data) !== true) send(main, text, topic(place));
			});
			polling = () => bots.map((each) => poll(host, each, stopping.signal, send));
		},
		start() {
			started = true;
			gate.resolve();
			polls = polling();
		},
		async stop() {
			stopping.abort();
			await Promise.all(polls);
			if (started) await sending;
		},
	};
}

// The bot at `bots[index]`, its token and chat from the variables it names; a value Telegram could not take refuses the load,
// naming the option and the variable, never the value.
function bot(env: Readonly<Record<string, string>>, { name, botTokenEnv, chatIdEnv }: BotOptions, index: number, apiUrl: string): Bot {
	const token = env[botTokenEnv] ?? "";
	if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error(`bots[${index}].botTokenEnv: ${botTokenEnv} does not hold a bot token as @BotFather gives it: digits, a colon, then letters, digits, _ and -`);
	const id = env[chatIdEnv] ?? "";
	if (!/^-?[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new Error(`bots[${index}].chatIdEnv: ${chatIdEnv} does not hold a chat id: a whole number, negative for a group`);
	return { label: name ?? "(unnamed)", token, chat: Number(id), apiUrl };
}

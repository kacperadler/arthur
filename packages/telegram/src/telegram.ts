import type { Plugin } from "@arthur/core/plugin";
import type { Bot } from "./bot-api.ts";
import { enqueue, outbox } from "./outbox.ts";
import { poll, type Send } from "./poll.ts";
import { checkOptions } from "./telegram-options.ts";

// The telegram plugin (spec/roadmap.md, entries 47 and 48): bots as instances, named and unnamed, each polling its one chat
// (poll.ts); the coordinator's replies by the bot the messages they answer came through, the notices by the unnamed bot,
// else the first, through the outbox (outbox.ts), without a notification in quiet hours, and a notice only when
// `call("coordinator.silent", notice)` does not hold it: packages/telegram/docs/telegram.md. Only `arthur run` starts the
// plugin, so only it polls and sends; what comes before the start, as the replay of the event log, is queued at the start.

export type BotOptions = { readonly name?: string; readonly botTokenEnv: string; readonly chatIdEnv: string };

export type TelegramOptions = { readonly enabled?: boolean; readonly bots: readonly BotOptions[]; readonly apiUrl?: string };

const asRecord = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;
// A place is a topic's `message_thread_id`; any other is not Telegram's, and the message goes to the chat itself.
// Telegram's own Bot API server, when `apiUrl` is left out.
export const API_URL = "https://api.telegram.org";
const topic = (place: unknown) => (typeof place === "string" && /^[1-9]\d{0,15}$/.test(place) ? place : undefined);

export function telegram(options: TelegramOptions): Plugin {
	// Set at setup: the start, which queues what came before it and starts the polls, and the end of the sends under way.
	let begin = (): Promise<void>[] => [];
	let idle = () => Promise.resolve();
	let polls: Promise<void>[] = [];
	const stopping = new AbortController();
	return {
		name: "telegram",
		options,
		check: checkOptions,
		setup(host) {
			const { bots: listed, apiUrl = API_URL } = host.options as TelegramOptions;
			const bots = listed.map((each, index) => bot(host.env, each, index, apiUrl.replace(/\/+$/, "")));
			const main = bots[Math.max(0, listed.findIndex((each) => each.name === undefined))] as Bot;
			const box = outbox(host, bots, main, stopping.signal);
			// What comes before the start, in order; the outbox is written only by a started plugin.
			const early: Parameters<Send>[] = [];
			let ready = false;
			const send: Send = (to, text, place) => {
				if (!ready) return void early.push([to, text, place]);
				enqueue(host.folder, to, text, place);
				box.flush();
			};
			// The bots the messages a reply answers came through (their `instance`), each once; the main bot when none did.
			const through = (answers: unknown) => {
				const seqs = Array.isArray(answers) ? answers.filter((seq): seq is number => Number.isSafeInteger(seq) && seq > 0) : [];
				const messages = bots.length > 1 && seqs.length > 0 ? host.events.read(Math.min(...seqs)).filter((event) => seqs.includes(event.seq) && event.name === "message-received") : [];
				const found = messages.filter((event) => asRecord(event.data).channel === "telegram").map((event) => bots.find((each) => each.name === asRecord(event.data).instance) ?? main);
				return found.length > 0 ? [...new Set(found)] : [main];
			};
			host.events.on("coordinator-replied", (event) => {
				const { text, channels, place, answers } = asRecord(event.data);
				if (typeof text === "string" && (!Array.isArray(channels) || channels.length === 0 || channels.includes("telegram"))) for (const each of through(answers)) send(each, text, topic(place));
			});
			host.events.on("notice", (event) => {
				const { text, place } = asRecord(event.data);
				if (typeof text === "string" && host.call<boolean>("coordinator.silent", event.data) !== true) send(main, text, topic(place));
			});
			begin = () => {
				ready = true;
				for (const each of early.splice(0)) send(...each);
				box.flush();
				return bots.map((each) => poll(host, each, stopping.signal, send, box.flush));
			};
			idle = box.idle;
		},
		start() {
			polls = begin();
		},
		async stop() {
			stopping.abort();
			await Promise.all(polls);
			await idle();
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
	return { ...(name === undefined ? {} : { name }), label: name ?? "(unnamed)", token, chat: Number(id), apiUrl };
}

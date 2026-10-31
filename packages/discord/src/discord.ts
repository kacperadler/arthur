import type { Plugin } from "@arthur/core/plugin";
import { checkOptions } from "./discord-options.ts";
import { requirements } from "./discord-doctor.ts";
import { gateway } from "./gateway.ts";
import { channelId, enqueue, outbox } from "./outbox.ts";
import { type Ear, receiver, type Send } from "./receive.ts";
import type { Bot } from "./rest.ts";

// The discord plugin (spec/roadmap.md, entry 89): bots as instances, named and unnamed, each on its one server through the
// gateway (gateway.ts), where the owner's text becomes `message-received` (receive.ts); the coordinator's replies by the bot
// the messages they answer came through, the notices by the unnamed bot, else the first, through the outbox (outbox.ts),
// without a notification in quiet hours, and a notice only when `call("coordinator.silent", notice)` does not hold it; each
// bot's requirements for `arthur doctor` (discord-doctor.ts): packages/discord/docs/discord.md. Only `arthur run` starts the
// plugin, so only it connects and sends; what comes before the start, as the replay of the event log, is queued at the start.

export type BotOptions = { readonly name?: string; readonly tokenEnv: string; readonly guildIdEnv: string; readonly userIdEnv: string; readonly channelIdEnv: string };

export type DiscordOptions = { readonly enabled?: boolean; readonly bots: readonly BotOptions[]; readonly apiUrl?: string };

const asRecord = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;
// Discord's own REST API, version 10, when `apiUrl` is left out.
export const API_URL = "https://discord.com/api/v10";

export function discord(options: DiscordOptions): Plugin {
	// Set at setup: the start, which queues what came before it and connects each bot, and the end of the sends under way.
	let [begin, idle] = [(): Promise<void>[] => [], () => Promise.resolve()];
	let connections: Promise<void>[] = [];
	const stopping = new AbortController();
	return {
		name: "discord",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			const { bots: listed, apiUrl = API_URL } = host.options as DiscordOptions;
			const bots = listed.map((each, index) => bot(host.env, each, index, apiUrl.replace(/\/+$/, "")));
			const main = bots[Math.max(0, listed.findIndex((each) => each.name === undefined))] as Bot;
			const ears = new Map<Bot, Ear>();
			const box = outbox(host, bots, main, (one) => ears.get(one)?.known(), stopping.signal);
			// What comes before the start, in order; the outbox is written only by a started plugin.
			const early: Parameters<Send>[] = [];
			let ready = false;
			const send: Send = (to, text, place) => {
				if (!ready) return void early.push([to, text, place]);
				enqueue(host.folder, to, text, place);
				box.flush();
			};
			for (const each of bots) ears.set(each, receiver(host, each, send, box.flush, stopping.signal));
			// The bots the messages a reply answers came through (their `instance`), each once; the main bot when none did.
			const through = (answers: unknown) => {
				const seqs = Array.isArray(answers) ? answers.filter((seq): seq is number => Number.isSafeInteger(seq) && seq > 0) : [];
				const messages = bots.length > 1 && seqs.length > 0 ? host.events.read(Math.min(...seqs)).filter((event) => seqs.includes(event.seq) && event.name === "message-received") : [];
				const found = messages.filter((event) => asRecord(event.data).channel === "discord").map((event) => bots.find((each) => each.name === asRecord(event.data).instance) ?? main);
				return found.length > 0 ? [...new Set(found)] : [main];
			};
			host.events.on("coordinator-replied", (event) => {
				const { text, channels, place, answers } = asRecord(event.data);
				if (typeof text === "string" && (!Array.isArray(channels) || channels.length === 0 || channels.includes("discord"))) for (const each of through(answers)) send(each, text, channelId(place));
			});
			host.events.on("notice", (event) => {
				const { text, place } = asRecord(event.data);
				if (typeof text === "string" && host.call<boolean>("coordinator.silent", event.data) !== true) send(main, text, channelId(place));
			});
			// A connection Discord ended for good is said on stderr and in a notice, which another channel or the terminal shows.
			const fatal = (line: string) => {
				console.error(line);
				host.events.emit("notice", { text: line });
			};
			begin = () => {
				ready = true;
				for (const each of early.splice(0)) send(...each);
				box.flush();
				return bots.map((each) => gateway(each, stopping.signal, (type, data) => ears.get(each)?.on(type, data), fatal));
			};
			idle = box.idle;
			host.provide("doctor", () => bots.flatMap(requirements));
		},
		start() {
			connections = begin();
		},
		async stop() {
			stopping.abort();
			await Promise.all(connections);
			await idle();
		},
	};
}

// The bot at `bots[index]`, its token and ids from the variables it names; a value Discord could not take refuses the load,
// naming the option and the variable, never the value.
function bot(env: Readonly<Record<string, string>>, options: BotOptions, index: number, apiUrl: string): Bot {
	const token = env[options.tokenEnv] ?? "";
	if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error(`bots[${index}].tokenEnv: ${options.tokenEnv} does not hold a bot token as Discord's developer portal gives it: three parts of letters, digits, _ and -, joined by dots`);
	const id = (key: "guildIdEnv" | "userIdEnv" | "channelIdEnv", what: string) => {
		const value = env[options[key]] ?? "";
		if (!/^[1-9]\d{0,19}$/.test(value) || BigInt(value) >= 2n ** 64n) throw new Error(`bots[${index}].${key}: ${options[key]} does not hold ${what}: a positive whole number below 2^64, as Copy ID gives it`);
		return value;
	};
	const [guild, user, channel] = [id("guildIdEnv", "a server id"), id("userIdEnv", "a user id"), id("channelIdEnv", "a channel id")];
	return { ...(options.name === undefined ? {} : { name: options.name }), label: options.name ?? "(unnamed)", token, tokenEnv: options.tokenEnv, guild, user, channel, apiUrl };
}

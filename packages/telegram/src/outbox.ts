import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { takeLock } from "@arthur/core/lock";
import type { Host } from "@arthur/core/plugin";
import { type ApiError, type Bot, call, topic } from "./bot-api.ts";
import { cut, slices } from "./slices.ts";

// The outbox (spec/roadmap.md, entry 48): every slice to send is first a file of `<folder>/outbox/`, named so that a plain sort
// is the order it goes in, across processes. One process at a time, holding `<folder>/outbox.lock`, sends them oldest first;
// a slice leaves the outbox once Telegram took it. A failed send is tried once more (after 2 s, a 429 after its retry_after);
// a slice that still fails stops the rest, so the order holds, and goes first next time. A refused (4xx) slice is set aside in
// `outbox/refused/` and the next goes: packages/telegram/docs/telegram.md, "Sending".

const MESSAGE = 4096;
const SEND_MS = 30_000;
const RETRY_MS = 2000;

type Slice = { readonly bot: string | null; readonly text: string; readonly place?: string };

// Telegram will never take the slice: a 4xx, but a 429 (too many requests), which only says to wait.
const refused = ({ code }: ApiError) => code >= 400 && code < 500 && code !== 429;

// One sequence for the whole process, so that two plugins in one process never write one name.
let last = 0;
let count = 0;

// `text` in slices of one message, each a file for `bot`, to `place` (a topic) when given.
export function enqueue(folder: string, bot: Bot, text: string, place: string | undefined): void {
	const outbox = join(folder, "outbox");
	mkdirSync(outbox, { recursive: true });
	for (const part of slices(text, MESSAGE)) {
		last = Math.max(Date.now(), last);
		const name = `${String(last).padStart(15, "0")}-${String(process.pid).padStart(10, "0")}-${String(count++).padStart(12, "0")}.json`;
		const slice: Slice = { bot: bot.name ?? null, text: part, ...(place === undefined ? {} : { place }) };
		writeFileSync(join(outbox, `${name}.tmp`), JSON.stringify(slice));
		renameSync(join(outbox, `${name}.tmp`), join(outbox, name));
	}
}

// The sender of one plugin: `flush` sends what the outbox holds, after the send under way; `idle` is the last one's end. A
// slice names its bot; one no longer configured goes from `main`. `signal` cuts every wait short, a call under way excepted.
export function outbox(host: Host, bots: readonly Bot[], main: Bot, signal: AbortSignal) {
	const folder = join(host.folder, "outbox");
	// `sending` is the last drain, `scheduled` whether one more waits behind it. Telegram's last 429 holds every call until
	// `notBefore`; `said` is the failure said last, `told` whether a refusal was told since a slice last went: each is said once
	// until a slice goes.
	let [sending, scheduled] = [Promise.resolve(), false];
	let [notBefore, said, told] = [0, "", false];
	const queued = () => readdirSync(folder).filter((name) => name.endsWith(".json")).sort();
	const pause = (ms: number) => (ms <= 0 ? Promise.resolve(true) : sleep(ms, true, { signal }).catch(() => false));

	// One send and one retry; undefined once Telegram took it, else the last failure.
	const attempt = async (bot: Bot, { text, place }: Slice): Promise<ApiError | undefined> => {
		let error: ApiError | undefined;
		for (let tries = 0; tries < 2; tries++) {
			if (tries === 1 && !(await pause(error?.code === 429 ? 0 : RETRY_MS))) break;
			if (!(await pause(notBefore - Date.now()))) break;
			try {
				const message = { chat_id: bot.chat, text, disable_notification: host.clock.isQuiet(), ...(place === undefined ? {} : { message_thread_id: Number(place) }) };
				await call(bot, "sendMessage", message, AbortSignal.timeout(SEND_MS));
				return undefined;
			} catch (thrown) {
				error = thrown as ApiError;
				if (error.code === 429) notBefore = Date.now() + (error.retryAfter > 0 ? error.retryAfter * 1000 : RETRY_MS);
				if (refused(error)) return error;
			}
		}
		return error ?? Object.assign(new Error(`telegram bot ${bot.label}: sendMessage: stopped before a 429's wait ended`), { code: 0, retryAfter: 0 });
	};

	// Moves the slice to `refused/` with one line on stderr; `why` is told in a notice when none was since a slice last went.
	const setAside = (name: string, why: string, text?: string) => {
		const aside = join(folder, "refused", name);
		mkdirSync(join(folder, "refused"), { recursive: true });
		renameSync(join(folder, name), aside);
		console.error(`${why}; the slice is set aside in ${aside}`);
		if (text === undefined || told) return;
		told = true;
		host.events.emit("notice", { text: cut(`${why}; this slice was set aside in ${aside}:\n${text}`, MESSAGE, `\n… cut; whole in ${aside}`) });
	};

	// Every queued slice in order; false when one failed and waits.
	const each = async () => {
		for (let name = queued()[0]; name !== undefined; name = queued()[0]) {
			const slice = read(join(folder, name));
			if (slice === undefined) {
				setAside(name, `telegram: ${join(folder, name)} is not a slice { bot, text, place? }`);
				continue;
			}
			const bot = bots.find((one) => one.name === (slice.bot ?? undefined)) ?? main;
			const error = await attempt(bot, slice);
			if (error === undefined) {
				rmSync(join(folder, name));
				[said, told] = ["", false];
			} else if (refused(error)) setAside(name, error.message, slice.text);
			else {
				if (said !== error.message) console.error(`${error.message}; the slice waits in ${folder} and goes first next time`);
				said = error.message;
				return false;
			}
		}
		return true;
	};

	// Under the lock; a live holder in another process sends ours too, since it lists the outbox again before it lets go.
	const drain = async () => {
		while (queued().length > 0) {
			const lock = takeLock(`${folder}.lock`);
			if (!("release" in lock)) return;
			try {
				if (!(await each())) return;
			} finally {
				lock.release();
			}
		}
	};

	return {
		flush() {
			if (scheduled) return;
			scheduled = true;
			sending = sending
				.then(() => {
					scheduled = false;
					mkdirSync(folder, { recursive: true });
					return drain();
				})
				.catch((error: Error) => console.error(`telegram: the outbox ${folder}: ${error.message}`));
		},
		idle: () => sending,
	};
}

// A slice as `enqueue` wrote it, else undefined: a file that does not parse, or was edited into another shape.
function read(path: string): Slice | undefined {
	try {
		const { bot = null, text, place } = JSON.parse(readFileSync(path, "utf8")) as Readonly<Record<string, unknown>>;
		if ((bot === null || typeof bot === "string") && typeof text === "string" && text.trim() !== "" && (place === undefined || topic(place) !== undefined)) return { bot, text, ...(place === undefined ? {} : { place: String(place) }) };
	} catch {}
	return undefined;
}

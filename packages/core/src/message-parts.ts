import { describe } from "./config.ts";
import type { Answer, Host } from "./plugin.ts";

// The parts of a channel's message (spec/roadmap.md, entry 49), the contract every channel keeps: one `message-received`
// `{ channel, parts, place?, instance? }` per message, its parts in the order the message holds them. `turnText` makes them the
// coordinator's text, asking the plugins that provide `message.part` for each part that is not text: docs/commands/send.md,
// "Message parts".

export type Kind = "text" | "photo" | "video" | "voice" | "audio" | "file";
export type Part = { readonly kind: Kind; readonly path?: string; readonly text?: string; readonly mime: string; readonly seconds?: number };
export type Received = { readonly channel: string; readonly parts: readonly Part[]; readonly place?: string; readonly instance?: string };
// What a plugin that handles a part's kind answers `message.part` (or a promise of it); any other plugin answers undefined.
export type Claim = { readonly text: string; readonly reply?: string };

const KINDS: readonly unknown[] = ["text", "photo", "video", "voice", "audio", "file"];
export const NOT_TRANSCRIBED = "[voice note not transcribed: the listen plugin is not enabled]";

const filled = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const record = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;

// The message as a channel emitted it, else what is wrong with it.
export function received(data: unknown): Received | string {
	const { channel, parts, place, instance } = record(data);
	if (!filled(channel)) return `expected channel, non-empty text, got ${describe(channel)}`;
	if (!Array.isArray(parts) || parts.length === 0) return `expected parts, a list of at least one part, got ${Array.isArray(parts) ? "an empty list" : describe(parts)}`;
	const wrong = parts.findIndex((part) => !isPart(part));
	if (wrong >= 0) return `parts[${wrong}]: expected { kind: text | photo | video | voice | audio | file, mime, text (a text part) or path (any other), seconds? }`;
	for (const [key, value] of [["place", place], ["instance", instance]] as const) if (value !== undefined && !filled(value)) return `expected ${key}, non-empty text when given, got ${describe(value)}`;
	return data as Received;
}

function isPart(value: unknown): boolean {
	const { kind, path, text, mime, seconds } = record(value);
	if (!KINDS.includes(kind) || !filled(mime)) return false;
	if (seconds !== undefined && !(typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0)) return false;
	return kind === "text" ? filled(text) : filled(path);
}

// Each part's text, in order, one line each: a text part's own; a part a plugin claims, its `text`, its `reply` sent back to the
// human through the channel the message came from (`coordinator-replied` answering `seq`); any other, its saved path.
export async function turnText(host: Pick<Host, "collectEach" | "events">, seq: number, message: Received): Promise<string> {
	const lines: string[] = [];
	for (const part of message.parts) {
		const { line, reply } = part.kind === "text" ? { line: part.text ?? "" } : await claim(host, part);
		lines.push(line);
		if (reply !== undefined) host.events.emit("coordinator-replied", { text: reply, answers: [seq], channels: [message.channel], ...(message.place === undefined ? {} : { place: message.place }) });
	}
	return lines.join("\n");
}

// The first claim in setup order; with none, the saved path, after the plugins that threw or rejected and their errors.
async function claim(host: Pick<Host, "collectEach">, part: Part): Promise<{ readonly line: string; readonly reply?: string }> {
	const saved = `[${[part.kind, part.mime, ...(part.seconds === undefined ? [] : [`${part.seconds} s`])].join(", ")}] (${part.path})`;
	// Every answer settled first, so one rejecting after an earlier claim won is no unhandled rejection.
	const settled = host.collectEach<unknown>("message.part", part).map((answer): Promise<Answer<unknown>> =>
		"error" in answer ? Promise.resolve(answer) : Promise.resolve(answer.value).then((value) => ({ plugin: answer.plugin, value }), (error: unknown) => ({ plugin: answer.plugin, error: error instanceof Error ? error : new Error(String(error)) })),
	);
	const failed: string[] = [];
	for (const pending of settled) {
		const answer = await pending;
		if ("error" in answer) failed.push(`${answer.plugin} failed: ${answer.error.message.replace(/\s+/g, " ").trim()}`);
		else if (typeof record(answer.value).text === "string") {
			const { text, reply } = answer.value as Claim;
			return { line: text, ...(filled(reply) ? { reply } : {}) };
		} else if (answer.value !== undefined) failed.push(`${answer.plugin} failed: it answered ${describe(answer.value)}, not { text, reply? }`);
	}
	if (failed.length > 0) return { line: `${saved}; ${failed.join("; ")}` };
	return part.kind === "voice" ? { line: NOT_TRANSCRIBED, reply: NOT_TRANSCRIBED } : { line: saved };
}

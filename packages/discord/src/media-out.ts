import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { channelId } from "./outbox.ts";
import { type ApiError, type Bot, rest } from "./rest.ts";

// `channel.send` on Discord (spec/roadmap.md, entry 90): files by the main bot in one message, one multipart request
// (`payload_json` and `files[n]`), the caption as its text, pinging no one, without a notification in quiet hours; to the
// place when it is a text channel of the bot's server, else to the main channel. Every file is checked before the send is
// answered, so a refusal sends nothing: packages/discord/docs/discord.md, "Sending files".

const MIB = 1024 * 1024;
// Discord's limits ("Uploading Files"): 10 files in one message, each up to 20 MiB and all of a request up to 25 MiB; a
// message's text up to 2000 characters.
const [FILES, FILE_BYTES, REQUEST_BYTES, CAPTION] = [10, 20 * MIB, 25 * MIB, 2000];
const UPLOAD_MS = 5 * 60_000;
// Discord's message flag SUPPRESS_NOTIFICATIONS (1 << 12).
const QUIET = 4096;

// The send of `message` `{ files, caption?, place? }`, else a throw with every refusal, one per line.
export function outgoing(bot: Bot, quiet: () => boolean, message: unknown): () => Promise<string> {
	const { files, caption = "", place } = typeof message === "object" && message !== null ? (message as Readonly<Record<string, unknown>>) : {};
	if (!Array.isArray(files) || files.length === 0 || !files.every((file) => typeof file === "string" && file !== "")) throw new Error("expected files, a list of at least one path");
	if (typeof caption !== "string") throw new Error("expected caption as text");
	const problems: string[] = [];
	if (files.length > FILES) problems.push(`${files.length} files; Discord takes at most ${FILES} in one message`);
	if (caption.length > CAPTION) problems.push(`the caption has ${caption.length} characters; Discord takes at most ${CAPTION}`);
	let total = Buffer.byteLength(caption);
	for (const path of files as string[]) {
		const stat = statSync(path, { throwIfNoEntry: false });
		if (!stat?.isFile()) problems.push(`${path}: no such file`);
		else if (stat.size === 0) problems.push(`${path}: empty; Discord takes no empty file`);
		else if (stat.size > FILE_BYTES) problems.push(`${path}: ${stat.size} bytes; Discord takes at most ${FILE_BYTES} (${FILE_BYTES / MIB} MiB) in one file`);
		else total += stat.size;
	}
	if (total > REQUEST_BYTES) problems.push(`${total} bytes in all; Discord takes at most ${REQUEST_BYTES} (${REQUEST_BYTES / MIB} MiB) in one message`);
	if (problems.length > 0) throw new Error(problems.join("\n"));
	const id = channelId(place);
	return async () => {
		const to = id === undefined || id === bot.channel ? bot.channel : await where(bot, id);
		const names = (files as string[]).map((path) => basename(path));
		const form = new FormData();
		const text = caption === "" ? {} : { content: caption };
		form.set("payload_json", JSON.stringify({ ...text, allowed_mentions: { parse: [] }, flags: quiet() ? QUIET : 0, attachments: names.map((filename, at) => ({ id: at, filename })) }));
		for (const [at, path] of (files as string[]).entries()) form.set(`files[${at}]`, new Blob([readFileSync(path)]), names[at]);
		await rest(bot, "POST", `/channels/${to}/messages`, form, new AbortController().signal, UPLOAD_MS);
		return `sent ${files.length} file${files.length === 1 ? "" : "s"} in 1 message`;
	};
}

// `place` when it is a text channel of the bot's server; the main channel when Discord says it is not one (a 4xx).
async function where(bot: Bot, place: string): Promise<string> {
	try {
		const channel = (await rest(bot, "GET", `/channels/${place}`, undefined, new AbortController().signal)) as Readonly<Record<string, unknown>> | null;
		return channel?.guild_id === bot.guild && channel.type === 0 ? place : bot.channel;
	} catch (error) {
		const { code } = error as ApiError;
		if (code >= 400 && code < 500 && code !== 429) return bot.channel;
		throw error;
	}
}

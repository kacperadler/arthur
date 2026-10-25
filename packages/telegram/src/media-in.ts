import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { Kind, Part } from "@arthur/core/parts";
import { type Bot, call, download } from "./bot-api.ts";

// What the owner sent as the parts of one message (spec/roadmap.md, entry 49): each message's file saved under `<folder>/media/`, in
// the order the messages came (an album is several), then each one's text or caption, one he forwarded marked `[forwarded from <sender>] `
// (the mark alone when it has neither). The channel reads no file; one Telegram will not hand over is a text part saying why: docs/telegram.md.

type File = { readonly file_id?: unknown; readonly file_unique_id?: unknown; readonly file_size?: unknown; readonly file_name?: unknown; readonly mime_type?: unknown; readonly duration?: unknown; readonly width?: unknown; readonly height?: unknown };

export type Message = {
	readonly chat?: { readonly id?: unknown }; readonly from?: { readonly id?: unknown }; readonly sender_chat?: unknown;
	readonly date?: unknown; readonly text?: unknown; readonly caption?: unknown;
	readonly forward_origin?: { readonly sender_user?: { readonly first_name?: unknown }; readonly sender_chat?: { readonly title?: unknown }; readonly chat?: { readonly title?: unknown } } | null;
	readonly media_group_id?: unknown; readonly message_thread_id?: unknown; readonly is_topic_message?: unknown;
	readonly photo?: readonly File[];
} & Readonly<Partial<Record<(typeof FILES)[number][0], File>>>;

// Each field of a message that holds a file, the kind of part it is, and its type when Telegram gives none.
const FILES = [["video", "video", "video/mp4"], ["video_note", "video", "video/mp4"], ["voice", "voice", "audio/ogg"], ["audio", "audio", "audio/mpeg"], ["document", "file", "application/octet-stream"]] as const;
const MB = 1024 * 1024;
// The most a bot may download through the Bot API.
const DOWNLOAD_BYTES = 20 * MB;
const DOWNLOAD_MS = 120_000;

export async function parts(bot: Bot, folder: string, messages: readonly Message[], signal: AbortSignal): Promise<Part[]> {
	const [files, texts]: [Part[], Part[]] = [[], []];
	for (const message of messages) {
		// The largest size of a photo: Telegram lists several.
		const photo = Array.isArray(message.photo) ? message.photo.reduce<File | undefined>((best, size) => (area(size) >= area(best) ? size : best), undefined) : undefined;
		const other = FILES.find(([name]) => message[name] !== undefined);
		const [file, kind, mime]: [File?, Kind?, string?] = photo !== undefined ? [photo, "photo", "image/jpeg"] : other === undefined ? [] : [message[other[0]], other[1], other[2]];
		if (file !== undefined && kind !== undefined) files.push(await save(bot, folder, file, kind, typeof file.mime_type === "string" && file.mime_type !== "" ? file.mime_type : (mime ?? ""), signal));
		const said = [message.text, message.caption].filter((said) => typeof said === "string" && said.trim() !== "");
		for (const text of said.length > 0 || message.forward_origin === undefined ? said : [""]) texts.push({ kind: "text", text: [forwarded(message), text].filter((part) => part !== "").join(" "), mime: "text/plain" });
	}
	return [...files, ...texts];
}

const area = (size: File | undefined) => (typeof size?.width === "number" && typeof size.height === "number" ? size.width * size.height : -1);

// A forwarded message's mark (Bot API MessageOrigin): a user's first name, else a chat's or a channel's title, cut of what could close the mark or break or reverse its line.
const forwarded = ({ forward_origin: origin }: Message) => (origin === undefined ? "" : `[forwarded from ${[origin?.sender_user?.first_name, origin?.sender_chat?.title, origin?.chat?.title].map((name) => (typeof name === "string" ? name.replace(/[\p{Cc}\p{Zl}\p{Zp}\p{Cf}\]]/gu, "") : "")).find((name) => name !== "") ?? "a hidden sender"}]`);

// The file at `<folder>/media/<its file_unique_id><extension>`, or `-<its name>` for one sent with a name; written whole.
async function save(bot: Bot, folder: string, file: File, kind: Kind, mime: string, signal: AbortSignal): Promise<Part> {
	const size = typeof file.file_size === "number" ? file.file_size : 0;
	const not = (why: string): Part => ({ kind: "text", text: `[${kind} not saved: ${why}]`, mime: "text/plain" });
	if (size > DOWNLOAD_BYTES) return not(`${size} bytes is over the ${DOWNLOAD_BYTES} (${DOWNLOAD_BYTES / MB} MB) a bot may download`);
	try {
		const within = AbortSignal.any([signal, AbortSignal.timeout(DOWNLOAD_MS)]);
		const found = await call(bot, "getFile", { file_id: file.file_id }, within);
		const remote = typeof found === "object" && found !== null && "file_path" in found ? found.file_path : undefined;
		if (typeof remote !== "string" || remote === "") return not("Telegram gave no file_path");
		const bytes = await download(bot, remote, within);
		// Both from the sender's side: the id kept to safe characters, the name to its last segment without control characters or leading dots.
		const id = String(file.file_unique_id ?? file.file_id).replace(/[^A-Za-z0-9_-]/g, "_");
		const name = typeof file.file_name === "string" ? (file.file_name.split(/[/\\]/).at(-1) ?? "").replace(/\p{Cc}/gu, "").replace(/^\.+/, "").slice(-100) : "";
		const path = join(folder, "media", name === "" ? `${id}${extname(remote).replace(/[^.A-Za-z0-9]/g, "")}` : `${id}-${name}`);
		mkdirSync(join(folder, "media"), { recursive: true });
		writeFileSync(`${path}.tmp`, bytes);
		renameSync(`${path}.tmp`, path);
		return { kind, path, mime, ...(typeof file.duration === "number" ? { seconds: file.duration } : {}) };
	} catch (error) {
		if (signal.aborted) throw error;
		return not(error instanceof Error ? error.message : String(error));
	}
}

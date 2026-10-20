import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { type Bot, call, topic } from "./bot-api.ts";

// `channel.send` on Telegram (spec/roadmap.md, entry 49): files by the main bot, to a topic when the place is one, without a
// notification in quiet hours: photos and videos as an album (one alone as itself), the other files as documents after it, the
// caption on the first message. Every file is checked before the send is answered, so a refusal sends nothing:
// packages/telegram/docs/telegram.md, "Sending files".

type Item = { readonly path: string; readonly kind: "photo" | "video" | "document" };

const KINDS: Readonly<Record<string, Item["kind"]>> = { ".jpg": "photo", ".jpeg": "photo", ".png": "photo", ".webp": "photo", ".mp4": "video", ".mov": "video" };
const METHODS: Readonly<Record<Item["kind"], string>> = { photo: "sendPhoto", video: "sendVideo", document: "sendDocument" };
const MB = 1024 * 1024;
// The Bot API's limits on a bot's upload: a photo up to 10 MB (a larger one goes as a document), any file up to 50 MB, 10 in
// an album, a caption of 1024 characters, a photo's width and height together up to 10000 px and at most 20 to 1.
const [PHOTO_BYTES, FILE_BYTES, ALBUM, CAPTION, SIDES, RATIO] = [10 * MB, 50 * MB, 10, 1024, 10_000, 20];
const UPLOAD_MS = 5 * 60_000;

// The send of `message` `{ files, caption?, place? }`, else a throw with every refusal, one per line.
export function outgoing(bot: Bot, quiet: () => boolean, message: unknown): () => Promise<string> {
	const { files, caption = "", place } = typeof message === "object" && message !== null ? (message as Readonly<Record<string, unknown>>) : {};
	if (!Array.isArray(files) || files.length === 0 || !files.every((file) => typeof file === "string" && file !== "")) throw new Error("expected files, a list of at least one path");
	if (typeof caption !== "string") throw new Error("expected caption as text");
	const problems: string[] = [];
	if (files.length > ALBUM) problems.push(`${files.length} files; Telegram takes at most ${ALBUM} in one album`);
	if (caption.length > CAPTION) problems.push(`the caption has ${caption.length} characters; Telegram takes at most ${CAPTION}`);
	const items = files.map((path): Item => {
		const stat = statSync(path, { throwIfNoEntry: false });
		const kind = KINDS[extname(path).toLowerCase()] ?? "document";
		if (!stat?.isFile()) problems.push(`${path}: no such file`);
		else if (stat.size === 0) problems.push(`${path}: empty; Telegram takes no empty file`);
		else if (stat.size > FILE_BYTES) problems.push(`${path}: ${stat.size} bytes; Telegram takes at most ${FILE_BYTES} (${FILE_BYTES / MB} MB) from a bot`);
		else if (kind === "photo") {
			const size = dimensions(readFileSync(path));
			if (size !== undefined && (size.width + size.height > SIDES || Math.max(size.width, size.height) > RATIO * Math.min(size.width, size.height)))
				problems.push(`${path}: ${size.width}x${size.height} px; Telegram takes a photo whose width plus height is at most ${SIDES} px and whose sides differ by at most ${RATIO} to 1; slice it into viewport-high images (for example 1600 px tall) and send them as one album`);
			return { path, kind: stat.size > PHOTO_BYTES ? "document" : kind };
		}
		return { path, kind };
	});
	if (problems.length > 0) throw new Error(problems.join("\n"));
	// A document goes in an album only with documents, so photos and videos go first, then the documents.
	const groups = [items.filter((item) => item.kind !== "document"), items.filter((item) => item.kind === "document")].filter((group) => group.length > 0);
	const thread = topic(place);
	return async () => {
		for (const [index, group] of groups.entries()) {
			const form = new FormData();
			form.set("chat_id", String(bot.chat));
			if (thread !== undefined) form.set("message_thread_id", thread);
			form.set("disable_notification", String(quiet()));
			const text = index === 0 && caption !== "" ? { caption } : {};
			for (const [at, item] of group.entries()) form.set(group.length === 1 ? item.kind : `file${at}`, new Blob([readFileSync(item.path)]), basename(item.path));
			if (group.length > 1) form.set("media", JSON.stringify(group.map((item, at) => ({ type: item.kind, media: `attach://file${at}`, ...(at === 0 ? text : {}) }))));
			else if (index === 0 && caption !== "") form.set("caption", caption);
			try {
				await call(bot, group.length > 1 ? "sendMediaGroup" : METHODS[group[0]?.kind ?? "document"], form, AbortSignal.timeout(UPLOAD_MS));
			} catch (error) {
				throw new Error(`${error instanceof Error ? error.message : String(error)}; ${index === 0 ? "nothing went" : `${index} of ${groups.length} messages went before it`}`);
			}
		}
		return `sent ${items.length} file${items.length === 1 ? "" : "s"} in ${groups.length} message${groups.length === 1 ? "" : "s"}`;
	};
}

// Width and height from the header of a PNG, a JPEG or a WebP; undefined for any other bytes, which Telegram then judges.
function dimensions(bytes: Buffer): { readonly width: number; readonly height: number } | undefined {
	if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
	if (bytes.length > 30 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") {
		const chunk = bytes.toString("latin1", 12, 16);
		if (chunk === "VP8X") return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
		if (chunk === "VP8L") return { width: (bytes.readUInt16LE(21) & 0x3fff) + 1, height: ((bytes.readUInt32LE(21) >> 14) & 0x3fff) + 1 };
		if (chunk === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
		return undefined;
	}
	if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
	for (let at = 2; at + 9 < bytes.length && bytes[at] === 0xff; at += 2 + bytes.readUInt16BE(at + 2)) {
		const marker = bytes[at + 1] ?? 0;
		// A start-of-frame marker holds the height, then the width.
		if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
	}
	return undefined;
}

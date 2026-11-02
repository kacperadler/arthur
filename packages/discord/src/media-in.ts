import { mkdirSync, renameSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Kind, Part } from "@arthur/core/parts";

// The files of one message the owner sent (spec/roadmap.md, entry 90), as parts: each attachment downloaded at once, since
// Discord's CDN links expire, to `<folder>/media/<attachment id>-<its file name>`, a voice message (IS_VOICE_MESSAGE) as `voice`
// with its `duration_secs` as `seconds`, any other by its type: `photo`, `video`, `audio`, else `file`. The CDN link is signed,
// so no token goes with it; a download that fails is a text part saying why. The channel reads no file: docs/discord.md.

// Discord's message flag IS_VOICE_MESSAGE (1 << 13).
const VOICE = 8192;
const DOWNLOAD_MS = 5 * 60_000;
const KINDS: readonly [string, Kind][] = [["image/", "photo"], ["video/", "video"], ["audio/", "audio"]];

const record = (value: unknown) => (typeof value === "object" && value !== null ? value : {}) as Readonly<Record<string, unknown>>;

// The attachments of `messages` (a message, and the one it forwards), in order. A stop under way makes the caller drop them.
export async function attachments(folder: string, messages: readonly Readonly<Record<string, unknown>>[], signal: AbortSignal): Promise<Part[]> {
	const parts: Part[] = [];
	for (const message of messages) {
		const voice = typeof message.flags === "number" && (message.flags & VOICE) !== 0;
		for (const each of Array.isArray(message.attachments) ? message.attachments.map(record) : []) parts.push(await save(folder, each, voice, signal));
	}
	return parts;
}

async function save(folder: string, attachment: Readonly<Record<string, unknown>>, voice: boolean, signal: AbortSignal): Promise<Part> {
	const { id, filename, content_type: type, duration_secs: seconds, url } = attachment;
	const mime = typeof type === "string" && type !== "" ? type : "application/octet-stream";
	const kind: Kind = voice ? "voice" : (KINDS.find(([prefix]) => mime.startsWith(prefix))?.[1] ?? "file");
	// Both from the sender's side: the id kept to safe characters, the name to its last segment without control characters or leading dots.
	const name = typeof filename === "string" ? (filename.split(/[/\\]/).at(-1) ?? "").replace(/\p{Cc}/gu, "").replace(/^\.+/, "").slice(-100) : "";
	const path = join(folder, "media", [String(id).replace(/[^A-Za-z0-9_-]/g, "_"), ...(name === "" ? [] : [name])].join("-"));
	const not = (why: string): Part => ({ kind: "text", text: `[${kind} ${name === "" ? "" : `${name} `}not saved: ${why}]`, mime: "text/plain" });
	if (typeof url !== "string") return not("Discord gave no url");
	try {
		const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(DOWNLOAD_MS)]) });
		if (!response.ok || response.body === null) return not(`Discord's CDN answered ${response.status}`);
		mkdirSync(join(folder, "media"), { recursive: true });
		await writeFile(`${path}.tmp`, response.body, { signal });
		renameSync(`${path}.tmp`, path);
		return { kind, path, mime, ...(typeof seconds === "number" ? { seconds } : {}) };
	} catch (error) {
		rmSync(`${path}.tmp`, { force: true });
		const cause = record(record(error).cause).code;
		return not(`${error instanceof Error ? error.message : String(error)}${typeof cause === "string" ? ` (${cause})` : ""}`);
	}
}

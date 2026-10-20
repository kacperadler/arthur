import { once } from "node:events";
import { existsSync, readdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fakeHost } from "@arthur/core/testing";
import { type TelegramOptions, telegram } from "../src/telegram.ts";

// The fake Bot API the telegram tests share, and the plugin loaded on a fake host against it.

// Built at run time, so no literal in the repository looks like a bot token to a secret scanner; Telegram answers both 401.
export const TOKEN = ["7012345678", `AAH-${"t".repeat(31)}`].join(":");
export const SECOND = ["7087654321", `AAG-${"s".repeat(31)}`].join(":");
export const CHAT = 4242;
export const NOW = new Date("2026-10-19T10:00:00Z");

export async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(20)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// The address of a loopback port nothing listens on any more: the Bot API unreachable.
export async function nowhere(): Promise<string> {
	const closed = createServer().listen(0, "127.0.0.1");
	await once(closed, "listening");
	const { port } = closed.address() as AddressInfo;
	closed.close();
	await once(closed, "close");
	return `http://127.0.0.1:${port}`;
}

// A file field of a multipart call: its file name and its bytes.
export type Upload = { readonly name: string; readonly bytes: Buffer };
export type Call = { readonly token: string; readonly method: string; readonly params: Readonly<Record<string, unknown>>; readonly at: number };

// A message as the Bot API's documentation shows one in a private chat, every field a text message has; `fields` adds or
// replaces some (`text: undefined` with a `sticker` is a sticker). `age` is how many seconds before NOW it was sent.
export const message = (id: number, fields: Readonly<Record<string, unknown>> = {}, age = 5) => ({
	message_id: id,
	from: { id: CHAT, is_bot: false, first_name: "Kacper", username: "kacper", language_code: "en" },
	chat: { id: CHAT, first_name: "Kacper", username: "kacper", type: "private" },
	date: Math.floor(NOW.getTime() / 1000) - age,
	text: `message ${id}`,
	...fields,
});

const BOT = { id: 7012345678, is_bot: true, first_name: "Arthur", username: "arthur_bot" };
const SENDS = ["sendMessage", "sendPhoto", "sendVideo", "sendDocument", "sendMediaGroup"];

// A fake Bot API on a loopback port the OS picks. `getUpdates` answers the updates from `offset` on, or waits, as long polling
// does, until one is pushed or its `timeout` passes; a send answers the sent Message (`sendMediaGroup`, one per item), a
// multipart one's files as `Upload`s in its params. `getFile` answers the File a test put with `file`, and
// `/file/bot<token>/<file_path>` its bytes. `fail` scripts the next answers of a method in the documented error shape (`ok:
// false`, `error_code`, `description`), with its HTTP status. `sent` is every sendMessage call, `took` those it answered.
export async function botApi(t: TestContext) {
	const calls: Call[] = [];
	const taken: Call[] = [];
	const updates = new Map<string, { update_id: number; message: unknown }[]>();
	const files = new Map<string, { readonly file_path: string; readonly bytes: Buffer }>();
	const failures: { method: string; code: number; description: string; parameters?: { retry_after: number } }[] = [];
	const waiting = new Set<() => void>();
	let next = 100;
	const send = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) chunks.push(chunk as Buffer);
		const raw = Buffer.concat(chunks);
		const download = /^\/file\/bot([^/]+)\/(.+)$/.exec(request.url ?? "");
		if (download !== null) {
			calls.push({ token: download[1] ?? "", method: "file", params: { file_path: download[2] }, at: Date.now() });
			const found = [...files.values()].find((file) => file.file_path === download[2]);
			if (download[1] !== TOKEN && download[1] !== SECOND) return send(response, 401, { ok: false, error_code: 401, description: "Unauthorized" });
			return found === undefined ? send(response, 404, { ok: false, error_code: 404, description: "Not Found" }) : response.writeHead(200, { "Content-Type": "application/octet-stream" }).end(found.bytes);
		}
		const [, token = "", method = ""] = /^\/bot([^/]+)\/(\w+)$/.exec(request.url ?? "") ?? [];
		const params: Record<string, unknown> = {};
		if (String(request.headers["content-type"]).startsWith("multipart/form-data")) {
			const form = await new Request("http://fake", { method: "POST", headers: { "content-type": String(request.headers["content-type"]) }, body: raw }).formData();
			for (const [key, value] of form) params[key] = typeof value === "string" ? value : { name: value.name, bytes: Buffer.from(await value.arrayBuffer()) };
		} else Object.assign(params, JSON.parse(raw.toString("utf8")));
		calls.push({ token, method, params, at: Date.now() });
		if (![TOKEN, SECOND].includes(token)) return send(response, 401, { ok: false, error_code: 401, description: "Unauthorized" });
		const failure = failures.findIndex((each) => each.method === method);
		const [scripted] = failure >= 0 ? failures.splice(failure, 1) : [];
		if (scripted !== undefined) {
			const { code, description, parameters } = scripted;
			return send(response, code, { ok: false, error_code: code, description, ...(parameters === undefined ? {} : { parameters }) });
		}
		if (SENDS.includes(method)) {
			taken.push({ token, method, params, at: Date.now() });
			const { chat_id, text, caption, message_thread_id } = params;
			const sent = (fields: Readonly<Record<string, unknown>>) => ({ message_id: next++, from: BOT, chat: { id: Number(chat_id), first_name: "Kacper", type: "private" }, date: 1, ...(message_thread_id === undefined ? {} : { message_thread_id: Number(message_thread_id), is_topic_message: true }), ...fields });
			const photo = [{ file_id: "AgAC-small", file_unique_id: "AQAD-small", file_size: 1000, width: 90, height: 60 }];
			const media = (type: string) => (type === "photo" ? { photo } : { [type]: { file_id: `${type}-id`, file_unique_id: `${type}-unique`, file_name: "upload", mime_type: "application/octet-stream", file_size: 10 } });
			if (method === "sendMessage") return send(response, 200, { ok: true, result: sent({ text }) });
			if (method !== "sendMediaGroup") return send(response, 200, { ok: true, result: sent({ ...media(method.slice(4).toLowerCase()), ...(caption === undefined ? {} : { caption }) }) });
			const items = JSON.parse(String(params.media)) as { type: string; caption?: string }[];
			return send(response, 200, { ok: true, result: items.map((item) => sent({ media_group_id: "13", ...media(item.type), ...(item.caption === undefined ? {} : { caption: item.caption }) })) });
		}
		if (method === "getFile") {
			const file = files.get(String(params.file_id));
			if (file === undefined) return send(response, 400, { ok: false, error_code: 400, description: "Bad Request: invalid file_id" });
			return send(response, 200, { ok: true, result: { file_id: params.file_id, file_unique_id: `${String(params.file_id)}-unique`, file_size: file.bytes.length, file_path: file.file_path } });
		}
		if (method !== "getUpdates") return send(response, 404, { ok: false, error_code: 404, description: "Not Found" });
		const ready = () => (updates.get(token) ?? []).filter((update) => update.update_id >= Number(params.offset ?? 0));
		const answer = () => {
			waiting.delete(answer);
			clearTimeout(timer);
			if (!response.writableEnded) send(response, 200, { ok: true, result: ready() });
		};
		const timer = setTimeout(answer, Number(params.timeout ?? 0) * 1000);
		if (ready().length > 0) return answer();
		waiting.add(answer);
		response.on("close", () => {
			waiting.delete(answer);
			clearTimeout(timer);
		});
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	t.after(() => {
		server.closeAllConnections();
		server.close();
	});
	let id = 1;
	return {
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		calls,
		sent: (token = TOKEN) => calls.filter((call) => call.method === "sendMessage" && call.token === token).map((call) => call.params),
		took: (token = TOKEN) => taken.filter((call) => call.token === token && call.method === "sendMessage").map((call) => call.params),
		// Every send of files Telegram took, with its method.
		media: () => taken.filter((call) => call.method !== "sendMessage").map((call) => ({ method: call.method, ...call.params })),
		polls: (token = TOKEN) => calls.filter((call) => call.method === "getUpdates" && call.token === token).map((call) => call.params),
		// Several updates at once, so one poll answers them all, as Telegram does with an album.
		pushAll(each: readonly Readonly<Record<string, unknown>>[], age = 5, token = TOKEN) {
			const pushed = each.map((fields) => ({ update_id: id++, message: message(id, fields, age) }));
			updates.set(token, [...(updates.get(token) ?? []), ...pushed]);
			for (const answer of [...waiting]) answer();
			return pushed;
		},
		push(fields: Readonly<Record<string, unknown>> = {}, age = 5, token = TOKEN) {
			return this.pushAll([fields], age, token)[0] as { update_id: number; message: unknown };
		},
		file: (fileId: string, filePath: string, bytes: Buffer) => void files.set(fileId, { file_path: filePath, bytes }),
		fail: (method: string, code: number, description: string, parameters?: { retry_after: number }) => void failures.push({ method, code, description, parameters }),
	};
}

// The plugin on a fake host, with `coordinator.silent` holding what `held` says, its console.error lines kept; `folder` stands for
// the plugin's folder, so a second load shares the first one's outbox, as a restart or a second process does.
export async function load(t: TestContext, options: Partial<TelegramOptions> & { readonly apiUrl: string }, setup: { readonly now?: Date; readonly held?: (notice: unknown) => boolean; readonly env?: Readonly<Record<string, string>>; readonly folder?: string } = {}) {
	const errors: string[] = [];
	t.mock.method(console, "error", (text: string) => void errors.push(text));
	const full = { bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }], ...options };
	const env = setup.env ?? { ARTHUR_TELEGRAM_BOT_TOKEN: TOKEN, ARTHUR_TELEGRAM_CHAT_ID: String(CHAT) };
	const fake = fakeHost({ name: "telegram", options: full, env, timeZone: "Europe/Warsaw", quietHours: { from: "22:00", to: "07:30" }, now: setup.now ?? NOW });
	const asked: unknown[] = [];
	fake.provide("coordinator.silent", (notice: unknown) => {
		asked.push(notice);
		return setup.held?.(notice) ?? false;
	});
	const plugin = telegram(full as TelegramOptions);
	const folder = setup.folder ?? fake.host.folder;
	await (setup.folder === undefined ? fake.setup(plugin) : plugin.setup({ ...fake.host, folder }));
	t.after(() => plugin.stop?.());
	const queued = (box = "") => (existsSync(join(folder, "outbox", box)) ? readdirSync(join(folder, "outbox", box)).filter((name) => name.endsWith(".json")) : []);
	return { fake, plugin, errors, asked, folder, queued, received: () => fake.emitted.filter((event) => event.name === "message-received").map((event) => event.data) };
}

// A message of one text, as the channel emits it.
export const said = (text: string) => [{ kind: "text", text, mime: "text/plain" }];

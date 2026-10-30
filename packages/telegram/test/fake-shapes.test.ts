import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { botApi, CHAT, SECOND, TOKEN } from "./fake-bot-api.ts";

// The fields of each type a fake answer holds, recorded in telegram-shapes.json from the field tables of the Bot API's
// documentation (its `source`, read on its `recorded` day). The fake changes shape only through a reviewed change of that file.
type Field = { readonly type: string; readonly optional?: true; readonly getMe?: true };
const { types } = JSON.parse(readFileSync(new URL("telegram-shapes.json", import.meta.url), "utf8")) as { types: Record<string, Record<string, Field>> };

// Each way `got` leaves the documented `type`: `-` a field the documentation does not mark Optional left out (in a getMe
// answer, also one it says getMe returns), `+` a key the type does not have. `Array of X` holds each item to X; a type not
// recorded (Integer, String, True) holds no keys.
const drift = (got: unknown, type: string, getMe: boolean, at: string): string[] => {
	const item = /^Array of (.+)$/.exec(type)?.[1];
	if (item !== undefined) return Array.isArray(got) ? got.flatMap((each, index) => drift(each, item, getMe, `${at}[${index}]`)) : [`${at}: not an array`];
	const fields = types[type];
	if (fields === undefined) return [];
	if (got === null || typeof got !== "object" || Array.isArray(got)) return [`${at}: not an object`];
	const has = got as Record<string, unknown>;
	return [
		...Object.entries(fields).filter(([key, field]) => (field.optional !== true || (getMe && field.getMe === true)) && !(key in has)).map(([key]) => `- ${at}.${key}`),
		...Object.keys(has).filter((key) => !(key in fields)).map((key) => `+ ${at}.${key}`),
		...Object.entries(has).flatMap(([key, value]) => drift(value, fields[key]?.type ?? "", getMe, `${at}.${key}`)),
	];
};

test("every answer of the fake Bot API holds the fields its documentation requires, and only fields it documents", async (t) => {
	const api = await botApi(t);
	api.push();
	api.file("AgAC-big", "photos/file_0.jpg", Buffer.from("jpeg"));
	api.fail("sendMessage", 429, "Too Many Requests: retry after 3", { retry_after: 3 });
	const media = JSON.stringify([{ type: "photo", media: "attach://a", caption: "first" }, { type: "video", media: "attach://b" }, { type: "document", media: "attach://c" }]);
	// Each call: its token, method and parameters, and the type of the `result` its answer holds (none for a refusal).
	const calls: readonly [string, string, Readonly<Record<string, unknown>>, string?][] = [
		[TOKEN, "sendMessage", { chat_id: CHAT, text: "refused" }],
		[TOKEN, "getUpdates", { offset: 0, timeout: 0 }, "Array of Update"],
		[TOKEN, "getMe", {}, "User"],
		[SECOND, "getMe", {}, "User"],
		[TOKEN, "sendMessage", { chat_id: CHAT, text: "hi" }, "Message"],
		[TOKEN, "sendMessage", { chat_id: CHAT, text: "hi", message_thread_id: 7 }, "Message"],
		[TOKEN, "sendPhoto", { chat_id: CHAT, photo: "attach://a", caption: "look" }, "Message"],
		[TOKEN, "sendVideo", { chat_id: CHAT, video: "attach://a" }, "Message"],
		[TOKEN, "sendDocument", { chat_id: CHAT, document: "attach://a" }, "Message"],
		[TOKEN, "sendMediaGroup", { chat_id: CHAT, media }, "Array of Message"],
		[TOKEN, "getFile", { file_id: "AgAC-big" }, "File"],
		[TOKEN, "getFile", { file_id: "none" }],
		[TOKEN, "setMyCommands", { commands: [] }, "True"],
		[TOKEN, "deleteMyCommands", {}, "True"],
		["7000000000:wrong", "getMe", {}],
	];
	const problems: string[] = [];
	for (const [token, method, params, result] of calls) {
		const response = await fetch(`${api.url}/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(params) });
		const body = (await response.json()) as { ok?: unknown; result?: unknown };
		problems.push(...drift(body, "Response", false, method), ...(result === undefined ? [] : drift(body.result, result, method === "getMe", `${method}.result`)));
		if (body.ok !== (result !== undefined)) problems.push(`${method}: ok is ${String(body.ok)}`);
	}
	assert.deepEqual(problems, []);
});

test("the comparison names a required field left out, a getMe field left out of getMe only, and a key not documented, at any depth", () => {
	const user = { id: 1, is_bot: false, first_name: "Jane" };
	const message = { message_id: 1, date: 2, chat: { id: 3, type: "private" }, from: user };
	assert.deepEqual(drift([message], "Array of Message", false, ""), []);
	assert.deepEqual(drift([message, { ...message, chat: { id: 3 }, from: { id: 1, first_name: "Jane", mood: "glad" } }], "Array of Message", false, ""), ["- [1].chat.type", "- [1].from.is_bot", "+ [1].from.mood"]);
	assert.deepEqual(drift(user, "User", false, ""), [], "can_join_groups is Optional outside getMe");
	assert.ok(drift(user, "User", true, "").includes("- .can_join_groups"), "getMe returns it");
	assert.deepEqual(drift(message, "Array of Message", false, "at"), ["at: not an array"]);
	assert.deepEqual(drift(null, "File", false, "at"), ["at: not an object"]);
	assert.deepEqual(drift(true, "True", false, "at"), [], "a type not recorded holds no keys");
});

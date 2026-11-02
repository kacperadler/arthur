import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Command, Host } from "@arthur/core/plugin";
import { temporaryFolder, until } from "@arthur/core/testing";
import type { DiscordOptions } from "../src/discord.ts";
import { fakeDiscord, load, MAIN, message, NOW, PROJECT, SECOND, said, snowflake } from "./fake-discord.ts";

// Phone commands on Discord (spec/roadmap.md, entry 90): `/name text` typed as a message.

const docs = temporaryFolder();

// A phone command on the fake host, as a plugin registers one; it answers what `reply` makes of its text and where it came from.
function phone(host: Host, name: string, reply: NonNullable<Command["phone"]>["reply"]): void {
	const doc = pathToFileURL(join(docs, `${name}.md`));
	writeFileSync(doc, `# arthur ${name}\n`);
	host.commands.register({ name, doc, run: () => 0, phone: { about: `the ${name}`, reply } });
}

const sent = (channel: string, content: string) => ({ channel, body: { content, allowed_mentions: { parse: [] }, flags: 0 } });

async function started(t: TestContext, bots?: DiscordOptions["bots"], env?: Readonly<Record<string, string>>) {
	const api = await fakeDiscord(t);
	const loaded = await load(t, { apiUrl: api.url, ...(bots === undefined ? {} : { bots }) }, env === undefined ? {} : { env });
	const commanded: unknown[] = [];
	phone(loaded.fake.host, "jobs", (text, from) => (commanded.push([text, from]), `jobs: ${text || "none"}`));
	await loaded.plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	return { api, commanded, ...loaded };
}

test("/name text runs the phone command with its channel and place, the reply goes back there, and nothing reaches the coordinator", async (t) => {
	const { api, commanded, received } = await started(t);
	api.message({ content: "/jobs all\nnow" });
	api.message({ content: "/jobs", channel_id: PROJECT, type: 19 });
	await until("both replies", () => api.took.length === 2);
	assert.deepEqual(api.took, [sent(MAIN, "jobs: all\nnow"), sent(PROJECT, "jobs: none")]);
	assert.deepEqual(commanded, [["all\nnow", { channel: "discord" }], ["", { channel: "discord", place: PROJECT }]]);
	assert.deepEqual(received(), []);
});

test("a named bot's command names its instance and is answered by that bot", async (t) => {
	const bots = [{ name: "shop", tokenEnv: "ARTHUR_DISCORD_SHOP_BOT_TOKEN", guildIdEnv: "ARTHUR_DISCORD_SHOP_GUILD_ID", userIdEnv: "ARTHUR_DISCORD_SHOP_USER_ID", channelIdEnv: "ARTHUR_DISCORD_SHOP_CHANNEL_ID" }];
	const env = { ARTHUR_DISCORD_SHOP_BOT_TOKEN: SECOND, ARTHUR_DISCORD_SHOP_GUILD_ID: "1100000000000000001", ARTHUR_DISCORD_SHOP_USER_ID: "1200000000000000002", ARTHUR_DISCORD_SHOP_CHANNEL_ID: MAIN };
	const { api, commanded } = await started(t, bots, env);
	api.message({ content: "/jobs" });
	await until("the reply", () => api.took.length === 1);
	assert.deepEqual(commanded, [["", { channel: "discord", instance: "shop" }]]);
	assert.equal(api.calls.find((call) => call.method === "POST")?.headers.authorization, `Bot ${SECOND}`);
});

test("an unknown command gets the registry's line; a slash that starts no name is a message to the coordinator", async (t) => {
	const { api, commanded, received } = await started(t);
	api.message({ content: "/Jobs" });
	api.message({ content: "/tmp/x is full" });
	api.message({ content: "/ hi" });
	api.message({ content: `/${"a".repeat(33)}` });
	api.message({ content: " /jobs" });
	await until("four messages and the line", () => received().length === 4 && api.took.length === 1);
	assert.deepEqual(api.took, [sent(MAIN, "unknown command /Jobs; phone commands: /jobs")]);
	assert.deepEqual(received(), [said("/tmp/x is full"), said("/ hi"), said(`/${"a".repeat(33)}`), said("/jobs")].map((parts) => ({ channel: "discord", parts })));
	assert.deepEqual(commanded, []);
});

test("never a command: a forward of one, one with a file, an edit to one; a command written while Arthur was away runs once", async (t) => {
	const api = await fakeDiscord(t);
	api.history = [message(snowflake(NOW.getTime() - 60_000, 1), { content: "/jobs away" })];
	const { fake, plugin, received, folder } = await load(t, { apiUrl: api.url });
	const asked: unknown[] = [];
	phone(fake.host, "jobs", (text) => (asked.push(text), "none"));
	await plugin.start?.();
	await until("the command from the backlog", () => asked.length === 1);
	const reference = { type: 1, channel_id: "1700000000000000001", message_id: "1700000000000000002" };
	const snapshot = { message: { type: 0, content: "/jobs forwarded", embeds: [], attachments: [], timestamp: "2026-10-31T09:00:00.000000+00:00", edited_timestamp: null, flags: 0, mentions: [], mention_roles: [] } };
	api.message({ content: "", message_reference: reference, message_snapshots: [snapshot] });
	api.message({ content: "/jobs with a file", attachments: [api.attach("1800000000000000031", "a.txt", "a", { content_type: "text/plain" })] });
	api.dispatch("MESSAGE_UPDATE", message(snowflake(NOW.getTime() - 4000), { content: "/jobs edited", edited_timestamp: "2026-10-31T09:59:59.000000+00:00" }));
	api.message({ content: "Last." });
	await until("three messages", () => received().length === 3);
	assert.deepEqual(received(), [
		{ channel: "discord", parts: said("[forwarded from a hidden sender] /jobs forwarded") },
		{ channel: "discord", parts: [{ kind: "file", path: join(folder, "media", "1800000000000000031-a.txt"), mime: "text/plain" }, ...said("/jobs with a file")] },
		{ channel: "discord", parts: said("Last.") },
	]);
	assert.deepEqual(asked, ["away"]);
	await plugin.stop?.();
	const again = await load(t, { apiUrl: api.url }, { folder });
	phone(again.fake.host, "jobs", (text) => (asked.push(text), "none"));
	await again.plugin.start?.();
	await until("identified again", () => api.sent(2).length === 2);
	api.message({ content: "/jobs after" });
	await until("the command after the restart", () => asked.length === 2);
	assert.deepEqual(asked, ["away", "after"], "the one from the backlog is not run again");
});

test("a reply longer than one message goes in slices of at most 2000, in order, through the outbox", async (t) => {
	const api = await fakeDiscord(t);
	const { fake, plugin, queued } = await load(t, { apiUrl: api.url });
	const lines = Array.from({ length: 30 }, (_, at) => `${String(at).padStart(2, "0")} ${"x".repeat(97)}`).join("\n");
	phone(fake.host, "long", () => lines);
	await plugin.start?.();
	await until("identified", () => api.sent(2).length === 1);
	api.message({ content: "/long" });
	await until("two slices sent", () => api.took.length === 2 && queued().length === 0);
	assert.deepEqual(api.took.map((each) => String(each.body.content)), [lines.slice(0, 19 * 101 - 1), lines.slice(19 * 101)]);
});

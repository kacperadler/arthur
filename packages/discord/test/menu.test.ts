import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Command, Host, Requirement } from "@arthur/core/plugin";
import { temporaryFolder, until } from "@arthur/core/testing";
import type { DiscordOptions } from "../src/discord.ts";
import { REFUSED } from "../src/interaction.ts";
import { receiver } from "../src/receive.ts";
import { BOT, type Call, fakeDiscord, GUILD, load, MAIN, OWNER, PROJECT, SECOND, STRANGER, THREAD, TOKEN, user } from "./fake-discord.ts";

// Discord's `/` menu (spec/roadmap.md, entry 90): the phone commands set as the server's guild commands at each READY, and a
// command picked there run as `/name text` is, answered through the interaction.

const docs = temporaryFolder();
const LONG = `restart Arthur: ${"the coordinator, its jobs and every plugin stop and start again, ".repeat(3)}`.trim();
const TEXT = { type: 3, name: "text", description: "the text after the command", required: false };
const PUTS = `/applications/${BOT}/guilds/${GUILD}/commands`;

// A phone command on the fake host, as a plugin registers one; it answers what `reply` makes of its text and where it came from.
function phone(host: Host, name: string, reply: NonNullable<Command["phone"]>["reply"], about = `the ${name}`): void {
	const doc = pathToFileURL(join(docs, `${name}.md`));
	writeFileSync(doc, `# arthur ${name}\n`);
	host.commands.register({ name, doc, run: () => 0, phone: { about, reply } });
}

// The plugin started with `/jobs`, answering `jobs: <text>` and keeping what it was asked, and `register` for more commands.
async function started(t: TestContext, setup: { bots?: DiscordOptions["bots"]; env?: Readonly<Record<string, string>>; register?: (host: Host) => void } = {}) {
	const api = await fakeDiscord(t);
	const loaded = await load(t, { apiUrl: api.url, ...(setup.bots === undefined ? {} : { bots: setup.bots }) }, setup.env === undefined ? {} : { env: setup.env });
	const commanded: unknown[] = [];
	phone(loaded.fake.host, "jobs", (text, from) => (commanded.push([text, from]), `jobs: ${text || "none"}`));
	setup.register?.(loaded.fake.host);
	await loaded.plugin.start?.();
	await until("the menu set", () => api.calls.some((call) => call.method === "PUT"));
	return { api, commanded, ...loaded };
}

const puts = (api: { readonly calls: readonly Call[] }) => api.calls.filter((call) => call.method === "PUT" && call.path === PUTS);
const deferred = (id: string, token: string) => ({ id, token, body: { type: 5 } });
const followup = (token: string, content: string) => ({ token, body: { content, allowed_mentions: { parse: [] } } });

test("at READY the phone commands become the server's / menu, each with its about cut to 100 and the text option; a start with the same set sends none", async (t) => {
	const { api, plugin, folder } = await started(t, { register: (host) => phone(host, "restart", () => "", LONG) });
	assert.ok(LONG.length > 100);
	assert.deepEqual(puts(api).map((call) => call.body), [
		[
			{ type: 1, name: "jobs", description: "the jobs", options: [TEXT] },
			{ type: 1, name: "restart", description: `${LONG.slice(0, 99)}…`, options: [TEXT] },
		],
	]);
	await until("the record written", () => existsSync(join(folder, "commands.json")));
	await plugin.stop?.();
	const again = await load(t, { apiUrl: api.url }, { folder });
	phone(again.fake.host, "jobs", () => "");
	phone(again.fake.host, "restart", () => "", LONG);
	await again.plugin.start?.();
	await until("identified again", () => api.sent(2).length === 2);
	await again.plugin.stop?.();
	assert.equal(puts(api).length, 1, "the same set is not sent again");
	// A command more, then a record broken by hand, each sends the set again.
	const third = await load(t, { apiUrl: api.url }, { folder });
	for (const name of ["jobs", "board"]) phone(third.fake.host, name, () => "");
	await third.plugin.start?.();
	await until("the new set", () => puts(api).length === 2);
	await third.plugin.stop?.();
	assert.deepEqual(api.commands.map((each) => each.name), ["board", "jobs"]);
	writeFileSync(join(folder, "commands.json"), "{ broken");
	const fourth = await load(t, { apiUrl: api.url }, { folder });
	for (const name of ["jobs", "board"]) phone(fourth.fake.host, name, () => "");
	await fourth.plugin.start?.();
	await until("set again after the broken record", () => puts(api).length === 3);
	// The PUT is answered before the record is rewritten: wait for the record itself, a read of "{ broken" being not yet.
	const record = () => {
		try {
			return JSON.parse(readFileSync(join(folder, "commands.json"), "utf8")) as Record<string, unknown>;
		} catch {
			return undefined;
		}
	};
	await until("the record rewritten", record);
	await fourth.plugin.stop?.();
	assert.deepEqual(Object.keys(record() ?? {}), [`${BOT}/${GUILD}`]);
});

test("no phone commands empties the menu; a refused PUT is one line without the token, the record unchanged, and the next start sets it", async (t) => {
	const api = await fakeDiscord(t);
	const empty = await load(t, { apiUrl: api.url });
	await empty.plugin.start?.();
	await until("the empty set", () => puts(api).length === 1);
	assert.deepEqual(puts(api)[0]?.body, []);
	// The PUT is answered before the record is written, and a stop between the two drops the write: wait for the record itself.
	await until("the record written", () => existsSync(join(empty.folder, "commands.json")));
	await empty.plugin.stop?.();
	const record = readFileSync(join(empty.folder, "commands.json"), "utf8");
	api.fail(`PUT ${PUTS}`, 403, { message: "Missing Access", code: 50001 });
	const refused = await load(t, { apiUrl: api.url }, { folder: empty.folder });
	phone(refused.fake.host, "jobs", () => "");
	await refused.plugin.start?.();
	await until("the refusal said", () => refused.errors.length === 1);
	assert.deepEqual(refused.errors, [`discord bot (unnamed): PUT ${PUTS}: 403: Missing Access; the / commands are set again at the next start`]);
	await refused.plugin.stop?.();
	assert.equal(readFileSync(join(empty.folder, "commands.json"), "utf8"), record);
	const next = await load(t, { apiUrl: api.url }, { folder: empty.folder });
	phone(next.fake.host, "jobs", () => "");
	await next.plugin.start?.();
	await until("set at the next start", () => api.commands.length === 1);
	await next.plugin.stop?.();
	assert.deepEqual(next.errors, []);
	assert.equal(puts(api).length, 3);
});

test("the fake refuses a description over 100 and a message's content over 2000, as Discord's documentation says", async (t) => {
	const api = await fakeDiscord(t);
	const put = (description: string) => fetch(`${api.url}${PUTS}`, { method: "PUT", headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify([{ type: 1, name: "jobs", description, options: [TEXT] }]) });
	assert.deepEqual([(await put("x".repeat(100))).status, (await put("x".repeat(101))).status], [200, 400]);
	assert.equal((await (await put("")).json()).code, 50035);
	const post = (path: string, content: string) => fetch(`${api.url}${path}`, { method: "POST", headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
	const picked = api.interaction("jobs");
	const statuses = [];
	for (const path of [`/channels/${MAIN}/messages`, `/webhooks/${BOT}/${picked.token}`]) statuses.push((await post(path, "x".repeat(2000))).status, (await post(path, "x".repeat(2001))).status);
	assert.deepEqual(statuses, [200, 400, 200, 400]);
});

test("a picked command answers deferred, runs as /name text with its channel and place, and its reply is the follow-up", async (t) => {
	const { api, commanded, received } = await started(t, { register: (host) => phone(host, "blank", () => "  ") });
	const [main, project, none, blank] = [api.interaction("jobs", "all\nnow"), api.interaction("jobs", undefined, { channel_id: PROJECT }), api.interaction("gone"), api.interaction("blank")];
	await until("four follow-ups", () => api.followups.length === 4);
	assert.deepEqual(api.callbacks.toSorted((a, b) => a.id.localeCompare(b.id)), [main, project, none, blank].map((each) => deferred(each.id, each.token)));
	assert.deepEqual(api.followups.toSorted((a, b) => a.token.localeCompare(b.token)), [
		followup(main.token, "jobs: all\nnow"),
		followup(project.token, "jobs: none"),
		followup(none.token, "unknown command /gone; phone commands: /blank, /jobs"),
		followup(blank.token, "/blank gave no reply"),
	]);
	assert.deepEqual(commanded.toSorted(), [["", { channel: "discord", place: PROJECT }], ["all\nnow", { channel: "discord" }]].toSorted());
	assert.deepEqual([received(), api.took], [[], []]);
});

test("a named bot's picked command names its instance and is answered with that bot's token", async (t) => {
	const bots = [{ name: "shop", tokenEnv: "SHOP_TOKEN", guildIdEnv: "SHOP_GUILD", userIdEnv: "SHOP_USER", channelIdEnv: "SHOP_CHANNEL" }];
	const { api, commanded } = await started(t, { bots, env: { SHOP_TOKEN: SECOND, SHOP_GUILD: GUILD, SHOP_USER: OWNER, SHOP_CHANNEL: MAIN } });
	api.interaction("jobs");
	await until("the follow-up", () => api.followups.length === 1);
	assert.deepEqual(commanded, [["", { channel: "discord", instance: "shop" }]]);
	assert.deepEqual(api.calls.filter((call) => call.method === "POST").map((call) => call.headers.authorization), [`Bot ${SECOND}`, `Bot ${SECOND}`]);
});

test("a reply longer than one message goes as follow-ups of at most 2000, cut at a line break, in order", async (t) => {
	const lines = Array.from({ length: 30 }, (_, at) => `${String(at).padStart(2, "0")} ${"x".repeat(97)}`).join("\n");
	const { api } = await started(t, { register: (host) => phone(host, "long", () => lines) });
	const picked = api.interaction("long");
	await until("two follow-ups", () => api.followups.length === 2);
	assert.deepEqual(api.followups, [followup(picked.token, lines.slice(0, 19 * 101 - 1)), followup(picked.token, lines.slice(19 * 101))]);
});

test("a reply of exactly 2000 is one follow-up; one of 2001 is two, 2000 and 1", async (t) => {
	const { api, errors, queued } = await started(t, {
		register: (host) => {
			phone(host, "fit", () => "f".repeat(2000));
			phone(host, "over", () => "o".repeat(2001));
		},
	});
	const [fit, over] = [api.interaction("fit"), api.interaction("over")];
	await until("three follow-ups", () => api.followups.length === 3);
	assert.deepEqual(api.followups.filter((each) => each.token === fit.token), [followup(fit.token, "f".repeat(2000))]);
	assert.deepEqual(api.followups.filter((each) => each.token === over.token), [followup(over.token, "o".repeat(2000)), followup(over.token, "o")]);
	assert.deepEqual([errors, api.took, queued()], [[], [], []]);
});

test("another user, server or channel, a DM, or one before the server is known gets an ephemeral refusal and runs nothing; other types are left alone", async (t) => {
	const { api, commanded, plugin } = await started(t);
	const owner = api.interaction("jobs", undefined, {}).member;
	const refusals = [
		api.interaction("jobs", "x", { member: { ...owner, user: user(STRANGER, "stranger") } }),
		api.interaction("jobs", "x", { guild_id: "1100000000000000999" }),
		api.interaction("jobs", "x", { channel_id: THREAD }),
		api.interaction("jobs", "x", { guild_id: undefined, member: undefined, user: user(OWNER, "alice"), context: 1 }),
	];
	api.interaction("jobs", "x", { type: 3 });
	api.interaction("jobs", "x", { type: 4 });
	await until("five answers", () => api.callbacks.length === 5);
	await plugin.stop?.();
	const refusal = { type: 4, data: { content: REFUSED, flags: 64, allowed_mentions: { parse: [] } } };
	assert.deepEqual(api.callbacks.filter((each) => each.body.type === 4).toSorted((a, b) => a.id.localeCompare(b.id)), refusals.map((each) => ({ id: each.id, token: each.token, body: refusal })));
	assert.deepEqual(commanded, [["", { channel: "discord" }]]);
	assert.equal(api.followups.length, 1);
	// Before GUILD_CREATE named the server's channels, even the owner's command in the main channel is refused.
	const bot = { label: "(unnamed)", token: TOKEN, tokenEnv: "T", guild: GUILD, user: OWNER, channel: MAIN, apiUrl: api.url };
	const loaded = await load(t, { apiUrl: api.url });
	const early = receiver(loaded.fake.host, bot, () => assert.fail("nothing goes to the outbox"), () => {}, new AbortController().signal);
	const first = api.interaction("jobs");
	early.on("INTERACTION_CREATE", first);
	await early.idle();
	assert.deepEqual(api.callbacks.at(-1), { id: first.id, token: first.token, body: refusal });
});

test("a refused deferred answer, late or replayed, runs nothing and is one line without the interaction token", async (t) => {
	const { api, commanded, errors } = await started(t);
	const late = api.interaction("jobs", "late");
	api.fail(`POST /interactions/${late.id}/${late.token}/callback`, 404, { message: "Unknown interaction", code: 10062 });
	const once = api.interaction("jobs", "once");
	await until("the first run", () => api.followups.length === 1);
	api.dispatch("INTERACTION_CREATE", once);
	await until("both refusals said", () => errors.length === 2);
	assert.deepEqual(errors.toSorted(), [
		`discord bot (unnamed): POST /interactions/${late.id}/{token}/callback: 404: Unknown interaction; the command picked from the / menu did not run`,
		`discord bot (unnamed): POST /interactions/${once.id}/{token}/callback: 400: Interaction has already been acknowledged.; the command picked from the / menu did not run`,
	]);
	assert.deepEqual(commanded, [["once", { channel: "discord" }]]);
	assert.ok(!errors.join("\n").includes(late.token) && !errors.join("\n").includes(once.token));
});

test("a failed follow-up sends the rest of the reply through the outbox to the channel it was picked in", async (t) => {
	const { api, errors } = await started(t);
	const picked = api.interaction("jobs", "lost", { channel_id: PROJECT });
	api.fail(`POST /webhooks/${BOT}/${picked.token}`, 404, { message: "Unknown Webhook", code: 10015 });
	await until("sent through the outbox", () => api.took.length === 1);
	assert.deepEqual(api.took, [{ channel: PROJECT, body: { content: "jobs: lost", allowed_mentions: { parse: [] }, flags: 0 } }]);
	assert.deepEqual(errors, [`discord bot (unnamed): POST /webhooks/${BOT}/{token}: 404: Unknown Webhook; the rest of /jobs's reply goes to the channel instead`]);
});

test("a stop waits for the picked command in hand, and its follow-up still goes before the stop ends", async (t) => {
	const { promise: answer, resolve: release } = Promise.withResolvers<string>();
	let asked = false;
	const { api, plugin } = await started(t, { register: (host) => phone(host, "slow", () => ((asked = true), answer)) });
	const picked = api.interaction("slow");
	await until("the command asked", () => asked);
	const stopped = plugin.stop?.();
	await until("the gateway closed", () => api.connections.at(-1)?.closed === 1000);
	release("done at last");
	await stopped;
	assert.deepEqual(api.followups, [followup(picked.token, "done at last")]);
});

// Each requirement the plugin provides to `arthur doctor`, with `/jobs` registered: its name, its check's line and its fix with
// `<folder>` for the plugin's folder.
async function doctor(t: TestContext, apiUrl: string) {
	const { fake, folder } = await load(t, { apiUrl });
	phone(fake.host, "jobs", () => "");
	const [list = []] = fake.collect<readonly Requirement[]>("doctor");
	return Promise.all(list.map(async (each) => [each.name, await each.check(), each.fix.replace(folder, "<folder>")] as const));
}

test("doctor: the commands line is ok when the server's menu lists the phone commands, missing when it differs or Discord refuses", async (t) => {
	const api = await fakeDiscord(t);
	const [, , , , lacking] = await doctor(t, api.url);
	assert.deepEqual(lacking?.slice(0, 2), ["bot (unnamed): commands", "missing: Discord's / menu differs from the phone commands at /jobs"]);
	api.commands = [{ name: "jobs", description: "the jobs" }, { name: "old", description: "gone" }];
	assert.equal((await doctor(t, api.url))[4]?.[1], "missing: Discord's / menu differs from the phone commands at /old");
	api.commands = [{ name: "jobs", description: "the jobs, said before" }];
	assert.equal((await doctor(t, api.url))[4]?.[1], "missing: Discord's / menu differs from the phone commands at /jobs");
	api.commands = [{ name: "jobs", description: "the jobs" }];
	const calls = api.calls.length;
	assert.equal((await doctor(t, api.url))[4]?.[1], "ok");
	assert.equal(api.calls.length - calls, 3, "each call once per doctor run");
	api.fail(`GET ${PUTS}`, 403, { message: "Missing Access", code: 50001 });
	const [, , , , refused] = await doctor(t, api.url);
	assert.deepEqual(refused?.slice(1), [
		`missing: Discord refused to list the / commands (discord bot (unnamed): GET ${PUTS}: 403: Missing Access)`,
		"invite the bot again with scope=bot+applications.commands (packages/discord/docs/discord.md, step 4), remove <folder>/commands.json and restart Arthur",
	]);
});

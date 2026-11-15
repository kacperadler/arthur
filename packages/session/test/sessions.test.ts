import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { fakeAgent, fakeHost, until } from "@arthur/core/testing";
import { session } from "../src/session.ts";
import { ask, checkout, HANDOFF, load as loaded, service, sessions } from "./restart-setup.ts";
import { coordinator, load } from "./session-setup.ts";

// Each session on its own (spec/roadmap.md, entry 88): the coordinator's and a project agent's, shop, whose chat is the place
// `shop` of the channel `test` (restart-setup.ts): its folder, its compaction one at a time, its fresh start, its /restart and
// its notices.

const HOST = hostname();
const lines = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line) as { args: string[] }) : []);

test("each session's extensions get its own folder: the coordinator's the plugin's, a project agent's agents/<project>/, made at setup; a session orchestration does not list gets none", async (t) => {
	const box = await load(t, {}, "2026-10-18T07:59:00+02:00", ["shop"]);
	const folders = (...asked: unknown[]) => box.fake.collect<{ file: string; env: Record<string, string> } | undefined>("coordinator.extension", ...asked).map((each) => each && [basename(each.file), each.env.ARTHUR_SESSION_FOLDER]);
	const shop = join(box.fake.host.folder, "agents", "shop");
	assert.deepEqual(folders({ session: "coordinator" }), [["handoff-extension.ts", box.fake.host.folder], ["turn-extension.ts", box.fake.host.folder]]);
	assert.deepEqual(folders({ session: "agent:shop" }), [["handoff-extension.ts", shop], ["turn-extension.ts", shop]]);
	assert.ok(existsSync(shop));
	for (const asked of [{ session: "agent:blog" }, {}, undefined]) assert.deepEqual(folders(asked), [undefined, undefined], JSON.stringify(asked));
	const alone = await load(t, {}, "2026-10-18T07:59:00+02:00");
	assert.deepEqual(alone.fake.collect("coordinator.extension", { session: "agent:shop" }), [undefined, undefined], "no project agent listed");
});

test("at a slot the sessions compact one after another, never together; one session's failed handoff withdraws only its own compaction", async (t) => {
	const box = await load(t, { compactAt: ["13:00"], compactWaitSeconds: 60 }, "2026-10-18T12:59:00+02:00", ["shop"]);
	const folder = join(box.fake.host.folder, "agents", "shop");
	const first = coordinator(t, box.fake, (gate) => ({ steps: [{ prompt: true }, { waitFor: gate("fail") }, { message: "Nothing to write." }, { end: true }, { waitFor: gate("release") }] }));
	const shop = coordinator(t, box.fake, (gate) => ({ steps: [{ prompt: true }, { waitFor: gate("written") }, { message: "Written." }, { end: true }, { prompt: true }, { message: "Going on." }, { end: true }, { waitFor: gate("release") }] }), [], "shop");
	await box.start();
	box.at("2026-10-18T13:00:00+02:00");
	await until("the coordinator's handoff request", () => first.messages().length === 1);
	assert.deepEqual([existsSync(join(folder, "request.json")), shop.messages()], [false, []], "shop's waits while the coordinator's is asked for");
	first.open("fail");
	await until("shop's handoff request", () => shop.messages().length === 1);
	assert.deepEqual(box.out, ["session: compact: skipped, handoff not written: no new handoff when the coordinator's turn ended"]);
	assert.match(String(shop.messages()[0]?.content), new RegExp(`handoff to ${join(folder, "handoff.md")},`));
	writeFileSync(join(folder, "handoff.md"), `${HANDOFF}\n`);
	shop.open("written");
	await until("shop's outcome", () => box.out.length === 2);
	assert.equal(box.out[1], "session: agent:shop: compact: done; the compacted conversation starts by reading the handoff");
	assert.deepEqual([first.compactions().length, shop.compactions().length], [0, 1]);
	assert.equal(existsSync(box.handoff), false, "nothing written in the coordinator's folder");
});

test("a turn's report in one session while another's compaction is asked for waits for it, then asks with its own slot; a request or report left in an agent's folder by the last run is dropped at the start", async (t) => {
	const box = await load(t, { compactOn: "context", compactAtPercent: 80, compactWaitSeconds: 600 }, "2026-10-18T12:59:00+02:00", ["shop"]);
	const folder = join(box.fake.host.folder, "agents", "shop");
	const request = () => (existsSync(join(folder, "request.json")) ? JSON.parse(readFileSync(join(folder, "request.json"), "utf8")) : undefined);
	writeFileSync(join(folder, "request.json"), JSON.stringify({ then: "compact", slot: "08:00", asked: Date.now(), waitSeconds: 600 }));
	writeFileSync(join(folder, "context-use"), "95");
	await box.start();
	assert.deepEqual([request(), existsSync(join(folder, "context-use"))], [undefined, false]);
	box.report("80");
	await until("the coordinator's request", () => box.request() !== undefined);
	writeFileSync(join(folder, "context-use"), "85");
	await until("shop's report read", () => !existsSync(join(folder, "context-use")));
	assert.equal(request(), undefined);
	writeFileSync(join(folder, "context-use"), "90");
	await until("shop's second report read", () => !existsSync(join(folder, "context-use")));
	rmSync(box.file);
	await until("shop's request", () => request() !== undefined);
	assert.deepEqual({ ...request(), asked: 0 }, { then: "compact", slot: "context 85%", asked: 0, waitSeconds: 600 }, "asked once, for its first report");
	box.report("95");
	await box.consumed();
	assert.equal(box.request(), undefined, "the coordinator's next waits for shop's in turn");
});

test("a project agent's fresh start waits only for its project's jobs and merges; the coordinator's for every one", async (t) => {
	for (const [job, merge, held] of [
		["acme", "acme", ["session: fresh: skipped, 1 job running, 1 merge running at 23:00"]],
		["shop", undefined, ["session: fresh: skipped, 1 job running at 23:00", "session: agent:shop: fresh: skipped, 1 job running at 23:00"]],
		[undefined, "shop", ["session: fresh: skipped, 1 merge running at 23:00", "session: agent:shop: fresh: skipped, 1 merge running at 23:00"]],
	] as const) {
		const box = await loaded(t, { freshAt: "23:00", freshUntil: "23:00" }, "2026-10-18T22:59:00+02:00", [], ["shop"]);
		// The coordinator's agent up, shop's not: shop's restart is made at once, with no handoff to wait for.
		await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }).up();
		if (job !== undefined) box.job("2026-10-18-worker-0000000a", "worker", job);
		box.fake.provide("delivery.merging", () => (merge === undefined ? [] : [{ project: merge, job: "" }]));
		await box.start();
		box.at("2026-10-18T23:00:00+02:00");
		const done = "session: agent:shop: fresh: done; the project agent of shop restarts in a fresh conversation, with no handoff: no project agent of shop was running";
		const out = held.length === 1 ? [...held, done] : held;
		await until("each session's outcome", () => box.out.length === out.length);
		assert.deepEqual([box.out.toSorted(), box.restarted], [out.toSorted(), held.length === 1 ? ["shop"] : []], `${job} job, ${merge} merge`);
	}
});

test("/restart restarts the session of the chat it came from: shop's from its place by its bot, the coordinator's from any other; arthur restart the one --project names", async (t) => {
	const box = await loaded(t, {}, "2026-10-18T12:00:00+02:00", [], ["shop"]);
	await box.start();
	const none = (who: string) => `no ${who} is running, so no handoff is asked; its next start goes on with --continue`;
	for (const [from, who] of [
		[{ channel: "test", place: "shop" }, "shop"],
		[undefined, "coordinator"],
		[{ channel: "test", place: "9" }, "coordinator"],
		[{ channel: "other", place: "shop" }, "coordinator"],
		[{ channel: "test", place: "shop", instance: "second" }, "coordinator"],
	] as const) {
		assert.equal(await box.route("/restart", from), none(who === "shop" ? "project agent of shop" : "coordinator"), JSON.stringify(from));
		assert.equal(box.restarted.at(-1), who, JSON.stringify(from));
	}
	box.fake.provide("channel.main", () => "first");
	await box.route("/restart", { channel: "test", place: "shop", instance: "first" });
	await box.route("/restart", { channel: "test", place: "shop" });
	assert.deepEqual(box.restarted.slice(-2), ["shop", "coordinator"], "a chat naming no bot is the main bot's");
	const run = box.fake.commands.find((command) => command.name === "restart")?.run;
	for (const [project, who] of [["shop", "shop"], ["acme", "coordinator"], [undefined, "coordinator"]] as const) {
		assert.equal(await run?.({ args: [], project }), 0);
		assert.equal(box.restarted.at(-1), who, String(project));
	}
	assert.equal(await run?.({ args: ["fresh"], project: "shop" }), 0);
	assert.deepEqual([box.restarted.at(-1), box.restarts.at(-1)], ["shop", true]);
	const [job, shop] = [box.job("2026-10-18-worker-0000000a"), { channel: "test", place: "shop", instance: "first" }];
	assert.equal(await box.route("/restart", shop), none("project agent of shop"), "acme's job holds only the coordinator's");
	assert.equal(box.restarted.at(-1), "shop");
	assert.equal(await box.route("/restart"), "error: 1 job running: 0000000a; run /stopall first");
	job.end();
	box.job("2026-10-18-worker-0000000b", "worker", "shop");
	assert.equal(await box.route("/restart", shop), "error: 1 job running: 0000000b; run /stopall first");
});

test("while a restart is due under the service, shop's /restart restarts shop alone; only the coordinator's restart due ends arthur run", async (t) => {
	const arthur = checkout();
	const box = await loaded(t, {}, "2026-10-18T12:00:00+02:00", arthur.code, ["shop"]);
	service(t, { restart: "always", pid: process.pid });
	await box.start();
	const job = box.job("2026-10-18-worker-0000000a");
	arthur.merge("AR0002");
	const reply = "no project agent of shop is running, so no handoff is asked; its next start goes on with --continue";
	assert.equal(await box.route("/restart", { channel: "test", place: "shop" }), reply);
	assert.deepEqual([box.restarted, box.ended], [["shop"], []]);
	job.end();
	await until("arthur run ended", () => box.ended.length === 1);
	assert.deepEqual(box.restarted, ["shop", "coordinator"]);
	assert.equal(existsSync(join(box.folder, "agents", "shop", "request.json")), false, "the restart due is the coordinator's");
});

test("/restart from shop's chat: shop's agent writes its handoff in its folder, only shop restarts, and Restarted. goes to its chat once its next agent is up", async (t) => {
	const box = await loaded(t, {}, "2026-10-18T12:00:00+02:00", [], ["shop"]);
	const handoff = join(box.folder, "agents", "shop", "handoff.md");
	const main = box.coordinator({ steps: [{ waitFor: box.gate("never") }] });
	const first = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("written") }, { message: "Written." }, { end: true }, { waitFor: box.gate("never") }] }, ["--continue"], "shop");
	await Promise.all([main.up(), first.up()]);
	await box.start();
	assert.equal(await box.route("/restart", { channel: "test", place: "shop" }), "restarting: the project agent of shop writes its handoff first, for at most 120 s; Restarted. follows");
	await until("the handoff request", () => first.messages().length === 1);
	assert.equal(first.messages()[0]?.content, ask(handoff, "and goes on with this one"));
	writeFileSync(handoff, `${HANDOFF}\n`);
	box.open("written");
	await until("the restart", () => box.restarted.length === 1);
	assert.deepEqual([box.restarted, box.out], [["shop"], ["session: agent:shop: restart: done; the project agent of shop restarts, which starts by reading the handoff"]]);
	await box.coordinator({ steps: [{ waitFor: box.gate("never") }] }, [], "shop").up();
	await until("the notice", () => box.notices("shop").length === 1);
	assert.deepEqual([box.notices("shop"), box.notices(), main.messages()], [["Restarted."], [], []]);
	const restarted = box.fake.emitted.find((event) => event.name === "notice" && (event.data as { text: string }).text === "Restarted.");
	assert.equal((restarted?.data as { channel?: string } | undefined)?.channel, "test");
});

test("a project agent that ends while its /restart waits for the handoff restarts without one, the line naming it", async (t) => {
	const box = await loaded(t, {}, "2026-10-18T12:00:00+02:00", [], ["shop"]);
	const shop = box.coordinator({ steps: [{ prompt: true }, { waitFor: box.gate("never") }] }, ["--continue"], "shop");
	await shop.up();
	await box.start();
	await box.route("/restart", { channel: "test", place: "shop" });
	await until("the handoff request", () => shop.messages().length === 1);
	shop.end();
	await until("the restart", () => box.restarted.length === 1);
	assert.deepEqual(box.out, ["session: agent:shop: restart: done; the project agent of shop restarts, with no handoff (handoff not written: the project agent of shop ended)"]);
});

test("each session's start notice, probed on its role's model in turn, and its turn failures go to its own chat; the doctor's missing lines only to the coordinator's", async (t) => {
	const omp = fakeAgent({ steps: [{ message: "Ready." }] });
	const path = process.env.PATH;
	process.env.PATH = `${dirname(omp)}${delimiter}${path}`;
	t.after(() => void (process.env.PATH = path));
	const fake = fakeHost({ name: "session", options: { compactAt: [] } });
	fake.provide("roles.model", (role: string) => ({ model: role === "coordinator" ? "anthropic/claude-opus-4-5" : role === "project" ? "anthropic/claude-sonnet-4-5" : undefined }));
	// Shop's chat names its bot, which its notices carry.
	const chat = { plugin: "test", instance: "second", place: "shop" };
	fake.provide("orchestration.sessions", () => sessions(["shop"]).map((each) => ("project" in each ? { ...each, chat } : each)));
	const plugin = session({}, 100);
	await fake.setup(plugin);
	t.after(() => plugin.stop?.());
	fake.emit("doctor", { lines: ["tmux: missing"] });
	const failed = join(fake.host.folder, "agents", "shop", "turn-failed");
	mkdirSync(failed, { recursive: true });
	writeFileSync(join(failed, `${Date.now()}-1-1.txt`), "529 overloaded");
	await plugin.start?.();
	const notices = () => fake.emitted.filter((event) => event.name === "notice").map((event) => event.data as Record<string, unknown>);
	await until("three notices", () => notices().length === 3);
	const shop = { channel: "test", instance: "second", place: "shop" };
	assert.deepEqual(
		notices().toSorted((a, b) => String(a.text).localeCompare(String(b.text))),
		[{ text: `project agent of shop up on ${HOST}`, ...shop }, { text: `tmux: missing\ncoordinator up on ${HOST}` }, { text: `turn failed on ${HOST}: 529 overloaded`, ...shop }],
	);
	assert.deepEqual(lines(join(dirname(omp), "starts.jsonl")).map((start) => start.args.at(-2)), ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"]);
});

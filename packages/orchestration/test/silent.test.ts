import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs, { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { type AgentStep, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";
import { endCoordinator } from "./coordinator-end.ts";
import { NO_UNIX_SOCKET } from "./unix-socket.ts";
import { ownerSaid } from "./owner-said.ts";

// The silent mode (spec/roadmap.md, entry 47, AR0127): `arthur silent` and `/silent`, its state file, the replies and notices it
// holds, its line in the coordinator's context, and its own end (AR0739).

const PATH = process.env.PATH ?? "";
const NOW = new Date("2026-10-19T08:00:00Z");
const WORK = "AR0207 to AR0209 merged; stop at $20";
// An `on` at NOW without `--until`: its end 24 hours on, its answer, and the end's sentence in the context.
const DAY = 86_400_000;
const END = new Date(NOW.getTime() + DAY).toISOString();
const ON = "silent: on until 10:00 on tue 2026-10-20";
const ENDS = (at: string) => `It ends on its own at ${at}, and Arthur tells the owner.`;
// The line Arthur puts under each reply it sends (context.ts, `jobsNow`): no job here is in a run.
const sent = (...texts: string[]) => texts.map((text) => `${text}\n\nJobs now: none`);
const USAGE = "usage: arthur silent [on '<the work; its stop condition>' [--until <HH:MM>] | off | ask]\n       /silent on <the work> [--until <HH:MM>] [--usage <percent>] [--tickets <id>,...] --recommend, the owner's grant, on his phone only";

// The plugin set up on a fake host in Warsaw, its coordinator not started; `silent.json` written before the setup when given,
// as an earlier process left it; with `agent`, project shop has its agent, in the folder `shop`. `run` is `arthur silent
// <args>`, its exit code and what it printed; `stop` sweeps the outbox.
async function setup(t: TestContext, before?: string, agent = false) {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", root]);
	const fake = fakeHost({ name: "orchestration", root, timeZone: "Europe/Warsaw", now: NOW });
	if (before !== undefined) writeFileSync(join(fake.host.folder, "silent.json"), before);
	if (agent) fake.provide("projects", () => [{ name: "shop", path: temporaryFolder(), prefix: "SH", pieces: { orchestration: { chat: { plugin: "telegram", place: "4" } } } }]);
	const plugin = orchestration();
	await fake.setup(plugin);
	const printed: string[] = [];
	t.mock.method(console, "log", (text: string) => void printed.push(text));
	t.mock.method(console, "error", (text: string) => void printed.push(text));
	const { folder } = fake.host;
	let written = 0;
	return {
		fake,
		folder,
		shop: join(folder, "agents", "shop"),
		async run(...args: string[]) {
			printed.length = 0;
			const code = await fake.commands.find((command) => command.name === "silent")?.run({ args, project: undefined });
			return [code ?? 0, printed.join("\n")] as const;
		},
		route: (text: string) => fake.host.commands.route(text),
		silent: (notice: unknown) => fake.call<boolean>("coordinator.silent", notice),
		state: () => (existsSync(join(folder, "silent.json")) ? (JSON.parse(readFileSync(join(folder, "silent.json"), "utf8")) as { since: string; seq: number; work: string; until: string }) : undefined),
		// A reply as the inbox extension writes it to the outbox of the session folder `of`, named after the time it was written.
		reply(text: string, channels: readonly string[], at = Date.now(), of = folder) {
			mkdirSync(join(of, "outbox"), { recursive: true });
			writeFileSync(join(of, "outbox", `${at}-${String(++written).padStart(6, "0")}.json`), JSON.stringify({ text, answers: [written], channels }));
		},
		sweep: () => plugin.stop?.(),
		replied: () => fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => (event.data as { text: string }).text),
		notices: () => fake.emitted.filter((event) => event.name === "notice").map((event) => event.data),
		held: (of = folder) => (existsSync(join(of, "outbox", "held")) ? readdirSync(join(of, "outbox", "held")).length : 0),
		async context() {
			printed.length = 0;
			await fake.commands.find((command) => command.name === "coordinator")?.run({ args: ["context"], project: undefined });
			return printed.join("\n").split("\n\n## Silent\n\n")[1]?.split("\n\n")[0];
		},
	};
}

test("/silent twice: on, then off with what happened meanwhile, built from the events since it went on", async (t) => {
	const { fake, route, state } = await setup(t);
	fake.emit("job-ended", { id: "2026-10-19-worker-00000001", kind: "worker", project: "arthur", state: "ended", reason: "finished" });
	assert.equal(await route("/silent"), ON);
	const on = state();
	assert.deepEqual(on, { since: NOW.toISOString(), seq: 2, work: "", until: END }, "the event before it, and its own phone-command, are not part of it");
	const jobs = ["2026-10-19-worker-0000000a", "2026-10-19-worker-0000000b", "2026-10-19-worker-0000000c", "2026-10-19-worker-0000000d"];
	fake.emit("job-ended", { id: jobs[0], kind: "worker", project: "arthur", state: "ended", reason: "finished" });
	fake.emit("job-ended", { id: jobs[1], kind: "worker", project: "arthur", state: "ended", reason: "failed: the agent exited 1" });
	fake.emit("job-ended", { id: jobs[2], kind: "worker", project: "arthur", state: "ended", reason: "finished" });
	fake.emit("job-ended", { id: jobs[3], kind: "worker", project: "arthur", state: "blocked", reason: "user: may I?" });
	fake.emit("ticket-moved", { id: "AR0207", project: "arthur", from: "review", to: "merged" });
	fake.emit("ticket-moved", { id: "AR0208", project: "arthur", from: "planned", to: "in-progress" });
	fake.emit("notice", { text: "machine gpu: its free CPU and memory are unknown" });
	fake.emit("notice", { text: `${jobs[3]} asks: may I?`, blocked: jobs[3] });
	assert.equal(
		await route("/silent"),
		[
			`silent: off, meanwhile: 4 jobs ended: 2 finished (${jobs[0]}, ${jobs[2]}), 1 failed (${jobs[1]}), 1 blocked (${jobs[3]}); 1 ticket merged: AR0207; 1 notice held:`,
			"- machine gpu: its free CPU and memory are unknown",
		].join("\n"),
	);
	assert.equal(state(), undefined);
	assert.equal(await route("/silent on"), ON);
	assert.equal(await route("/silent off"), "silent: off, nothing happened meanwhile");
});

test("arthur silent on while on keeps since when and replaces the work; the context names both", async (t) => {
	const { fake, run, state, context } = await setup(t);
	assert.equal(await context(), undefined, "no section while off");
	assert.deepEqual(await run("on", "AR0207 merged"), [0, ON]);
	fake.setNow(new Date("2026-10-19T09:30:00Z"));
	fake.emit("notice", { text: "later" });
	assert.deepEqual(await run("on", WORK), [0, "silent: on until 11:30 on tue 2026-10-20"], "its end is this on's");
	assert.deepEqual(state(), { since: NOW.toISOString(), seq: 0, work: WORK, until: "2026-10-20T09:30:00.000Z" });
	assert.equal(await context(), `On since 10:00 on mon 2026-10-19, for: ${WORK}. ${ENDS("11:30 on tue 2026-10-20")}`);
	assert.deepEqual(await run("off"), [0, "silent: off, meanwhile: 1 notice held:\n- later"], "what came after the first on");
	assert.deepEqual(await run("on"), [0, "silent: on until 11:30 on tue 2026-10-20"]);
	assert.equal(await context(), `On since 11:30 on mon 2026-10-19, for: nothing named; the owner turned it on. ${ENDS("11:30 on tue 2026-10-20")}`);
});

test("arthur silent off while off answers silent: off and changes nothing; a wrong word is the usage", async (t) => {
	const { folder, run, route } = await setup(t);
	const before = readdirSync(folder).sort();
	assert.deepEqual(await run("off"), [0, "silent: off"]);
	assert.deepEqual(await run("ask"), [0, "silent: off"]);
	assert.deepEqual(readdirSync(folder).sort(), before);
	assert.deepEqual(await run("loud"), [2, USAGE]);
	assert.deepEqual(await run("off", "now"), [2, USAGE]);
	assert.equal(await route("/silent please"), USAGE.replace("arthur silent", "/silent"));
	assert.deepEqual(readdirSync(folder).sort(), before);
});

test("coordinator.silent holds every notice while on, but the one of a job blocked on the owner and the one of a high-impact answer recorded", async (t) => {
	const { run, silent } = await setup(t);
	const ordinary = { text: "the coordinator's last 3 turns ended without a reply" };
	const blocked = { text: "AR1 asks: may I?", blocked: "2026-10-19-worker-00000001" };
	const recorded = { text: "Recorded as your decision AR-D1 (budget, lets through --budget 0): Go; picked: option 1, \"Go\"; your words: \"AR-D1 yes\"", decision: "AR-D1" };
	assert.deepEqual([silent(ordinary), silent(blocked), silent(recorded)], [false, false, false], "off: nothing is held");
	await run("on", WORK);
	assert.deepEqual([silent(ordinary), silent(blocked), silent(recorded), silent(undefined), silent({ text: "x", decision: 1 })], [true, false, false, true, true]);
	await run("off");
	assert.equal(silent(ordinary), false);
});

test("while on, a reply to only Arthur's messages is held; an owner's is sent; ask lets the next reply through once; off sends again", async (t) => {
	const { folder, run, reply, sweep, replied, held } = await setup(t);
	await run("on", WORK);
	reply("A job ended.", []);
	reply("Your answer.", ["telegram"]);
	reply("Written before the ask.", [], Date.now() - 1000);
	await sweep();
	assert.deepEqual(replied(), sent("Your answer."));
	assert.equal(held(), 2);
	assert.deepEqual(await run("ask"), [0, "silent: on; the reply of this turn goes to the owner"]);
	reply("Before the ask, swept after it.", [], Date.now() - 1000);
	reply("A decision for you.", [], Date.now() + 1);
	reply("The next wake.", [], Date.now() + 2);
	await sweep();
	assert.deepEqual(replied(), sent("Your answer.", "A decision for you."));
	assert.equal(existsSync(join(folder, "silent-ask")), false, "one ask, one reply");
	assert.equal(held(), 4);
	await run("off");
	reply("Done: all merged.", []);
	await sweep();
	assert.deepEqual(replied(), sent("Your answer.", "A decision for you.", "Done: all merged."));
	await run("on");
	await run("ask");
	await run("off");
	await run("on");
	reply("A wake after a stale ask.", [], Date.now() + 5);
	await sweep();
	assert.equal(held(), 5, "off removes an ask left behind");
	await run("off");
	// A mark a crashed process left while off.
	writeFileSync(join(folder, "silent-ask"), String(Date.now()));
	await run("on");
	reply("A wake after an ask from before on.", [], Date.now() + 10);
	await sweep();
	assert.equal(held(), 6, "on from off removes an ask left behind");
});

// AR0713: the ask was one file for every session, so an agent's job-end reply used it up and the coordinator's question was held.
test("an ask lets through only the next reply of the session that ran it; another session's reply after it is held; on from off and off remove every session's", async (t) => {
	const { folder, shop, run, reply, sweep, replied, held } = await setup(t, undefined, true);
	t.after(() => delete process.env.ARTHUR_ORCHESTRATION_FOLDER);
	const asks = () => [folder, shop].map((each) => existsSync(join(each, "silent-ask")));
	// The agent's folder, as its supervisor makes it at its start.
	mkdirSync(shop, { recursive: true });
	assert.deepEqual([await run("ask"), asks()], [[0, "silent: off"], [false, false]], "while off an ask leaves no mark");
	await run("on", WORK);
	// Outside every session: the coordinator's ask.
	await run("ask");
	assert.deepEqual(asks(), [true, false]);
	reply("Shop: the job ended.", [], Date.now() + 1, shop);
	await sweep();
	assert.deepEqual([replied(), held(shop), asks()], [[], 1, [true, false]], "the agent's reply does not use up the coordinator's ask");
	reply("Merge AR0207?", [], Date.now() + 2);
	await sweep();
	assert.deepEqual([replied(), held(), asks()], [sent("Merge AR0207?"), 0, [false, false]]);
	// In the agent's session: its own ask, which the coordinator's reply does not use up.
	process.env.ARTHUR_ORCHESTRATION_FOLDER = shop;
	assert.deepEqual(await run("ask"), [0, "silent: on; the reply of this turn goes to the owner"]);
	assert.deepEqual(asks(), [false, true]);
	reply("A job ended.", [], Date.now() + 3);
	await sweep();
	assert.deepEqual([replied().length, held(), asks()], [1, 1, [false, true]]);
	reply("Shop: approve SH0001?", [], Date.now() + 4, shop);
	reply("Shop: the next wake.", [], Date.now() + 5, shop);
	await sweep();
	assert.deepEqual([replied(), held(shop), asks()], [sent("Merge AR0207?", "Shop: approve SH0001?"), 2, [false, false]], "one ask, one reply of its session");
	// A session's folder no project names (a removed agent's, another home's): the coordinator's ask.
	process.env.ARTHUR_ORCHESTRATION_FOLDER = join(folder, "agents", "blog");
	await run("ask");
	assert.deepEqual(asks(), [true, false]);
	process.env.ARTHUR_ORCHESTRATION_FOLDER = shop;
	await run("ask");
	process.env.ARTHUR_ORCHESTRATION_FOLDER = folder;
	await run("off");
	assert.deepEqual(asks(), [false, false], "off removes every session's ask");
	for (const each of [folder, shop]) writeFileSync(join(each, "silent-ask"), String(Date.now()));
	await run("on");
	assert.deepEqual(asks(), [false, false], "on from off removes every session's ask");
	await run("ask");
	process.env.ARTHUR_ORCHESTRATION_FOLDER = shop;
	await run("ask");
	await run("on", "Other work.");
	assert.deepEqual(asks(), [true, true], "on while on keeps each ask");
});

// The state an Arthur before AR0739 wrote has no `until`: it ends 24 hours after its `since`.
test("a restart while on: still on, the context says so, held replies stay held and the next one is held too", async (t) => {
	const state = JSON.stringify({ since: "2026-10-19T06:15:00.000Z", seq: 0, work: WORK });
	const { folder, reply, sweep, replied, held, context, silent } = await setup(t, state);
	mkdirSync(join(folder, "outbox", "held"), { recursive: true });
	writeFileSync(join(folder, "outbox", "held", "1-000001.json"), JSON.stringify({ text: "Held before.", answers: [1], channels: [] }));
	assert.equal(await context(), `On since 08:15 on mon 2026-10-19, for: ${WORK}. ${ENDS("08:15 on tue 2026-10-20")}`);
	reply("After the restart.", []);
	await sweep();
	assert.deepEqual(replied(), []);
	assert.equal(held(), 2);
	assert.equal(silent({ text: "x" }), true);
});

test("a state file that does not parse counts as on, its context line names it, it never ends on its own, and arthur silent off removes it", async (t) => {
	const whole = { since: NOW.toISOString(), seq: 0, work: WORK };
	for (const broken of ["{ not json", JSON.stringify({ since: 5 }), "null", JSON.stringify({ ...whole, since: "this morning" }), JSON.stringify({ ...whole, until: "tonight" }), JSON.stringify({ ...whole, until: null })]) {
		const { fake, folder, run, reply, sweep, replied, notices, context, silent } = await setup(t, broken);
		const file = join(folder, "silent.json");
		assert.equal(await context(), `On: ${file} does not parse, so it counts as on; \`arthur silent off\` removes it.`, broken);
		assert.equal(silent({ text: "x" }), true);
		// Long past any end.
		fake.setNow(new Date(NOW.getTime() + 30 * DAY));
		reply("Held.", []);
		await sweep();
		assert.deepEqual([replied(), notices(), existsSync(file)], [[], [], true], broken);
		assert.deepEqual(await run("off"), [0, `silent: off, ${file} did not parse, so what happened meanwhile is unknown`]);
		assert.equal(existsSync(file), false);
		assert.equal(await context(), undefined);
	}
});

// AR0739: turned on for a night's work, it stayed on for six days, and every reply to a job's end, a review or a merge was held.
test("at its end the mode goes off on its own: nothing a moment before; then one notice with what happened meanwhile, each session's ask gone, and the next reply sent", async (t) => {
	const { fake, folder, shop, run, reply, sweep, replied, notices, held, state, silent } = await setup(t, undefined, true);
	mkdirSync(shop, { recursive: true });
	assert.deepEqual(await run("on", WORK, "--until", "09:00"), [0, "silent: on until 09:00 on tue 2026-10-20"], "the next 09:00 in Warsaw");
	assert.deepEqual(state(), { since: NOW.toISOString(), seq: 0, work: WORK, until: "2026-10-20T07:00:00.000Z" });
	for (const each of [folder, shop]) writeFileSync(join(each, "silent-ask"), String(Date.now() + 60_000));
	const job = "2026-10-19-worker-0000000a";
	fake.emit("job-ended", { id: job, kind: "worker", project: "arthur", state: "ended", reason: "finished" });
	fake.emit("notice", { text: "later" });
	fake.setNow(new Date("2026-10-20T06:59:59.999Z"));
	reply("A job ended.", []);
	await sweep();
	assert.deepEqual([replied(), notices(), held(), silent({ text: "x" })], [[], [], 1, true], "a millisecond before its end");
	fake.setNow(new Date("2026-10-20T07:00:00.000Z"));
	reply("The review passed.", []);
	await sweep();
	const told = `silent: off on its own, its end 09:00 on tue 2026-10-20 came (on since 10:00 on mon 2026-10-19, for: ${WORK}); meanwhile: 1 job ended: 1 finished (${job}); 1 notice held:\n- later`;
	assert.deepEqual(notices(), [{ text: told }]);
	assert.deepEqual([state(), silent({ text: "x" }), readdirSync(folder).filter((name) => name.startsWith("silent")), existsSync(join(shop, "silent-ask"))], [undefined, false, [], false]);
	assert.deepEqual([replied(), held()], [sent("The review passed."), 1], "the reply of the sweep that ended it goes out, and what was held stays held");
	// The end came once: a second sweep, and an off by hand after it, tell nothing more.
	await sweep();
	assert.deepEqual([await run("off"), notices().length], [[0, "silent: off"], 1]);
});

test("an on without --until ends 24 hours on, a state without until 24 hours after its since; an off by hand first leaves the end nothing to tell", async (t) => {
	const plain = await setup(t);
	await plain.run("on");
	plain.fake.setNow(new Date(NOW.getTime() + DAY - 1));
	await plain.sweep();
	assert.deepEqual([plain.notices(), plain.state()?.until], [[], END]);
	plain.fake.setNow(new Date(NOW.getTime() + DAY));
	await plain.sweep();
	assert.deepEqual([plain.notices(), plain.state()], [[{ text: "silent: off on its own, its end 10:00 on tue 2026-10-20 came (on since 10:00 on mon 2026-10-19, for: nothing named); nothing happened meanwhile" }], undefined]);
	// As the state of 2026-11-18 was: on for days, written without an end.
	const old = await setup(t, JSON.stringify({ since: "2026-10-18T06:15:00.000Z", seq: 0, work: WORK }));
	old.fake.setNow(new Date("2026-10-19T06:14:59.999Z"));
	await old.sweep();
	assert.deepEqual(old.notices(), []);
	old.fake.setNow(new Date("2026-10-19T06:15:00.000Z"));
	old.reply("A job ended.", []);
	await old.sweep();
	assert.deepEqual(old.notices(), [{ text: `silent: off on its own, its end 08:15 on mon 2026-10-19 came (on since 08:15 on sun 2026-10-18, for: ${WORK}); nothing happened meanwhile` }]);
	assert.deepEqual(old.replied(), sent("A job ended."));
	const byHand = await setup(t);
	await byHand.run("on", WORK);
	byHand.fake.setNow(new Date(NOW.getTime() + 2 * DAY));
	assert.deepEqual(await byHand.run("off"), [0, "silent: off, nothing happened meanwhile"]);
	await byHand.sweep();
	assert.deepEqual(byHand.notices(), []);
});

// The end and an `arthur silent off` of another process at the same instant: each read the state, one renames its file first.
test("of the end and an off by hand at once, the one that finds the state file taken tells nothing: no notice from the end, silent: off from the off", async (t) => {
	const { fake, folder, run, sweep, notices, state } = await setup(t);
	const rename = fs.renameSync;
	// The other process takes the file between this one's read of the state and its rename.
	const taken = (act: () => unknown) => {
		const mocked = t.mock.method(fs, "renameSync", (from: string, to: string) => {
			if (from === join(folder, "silent.json")) rmSync(from);
			rename(from, to);
		});
		syncBuiltinESMExports();
		return Promise.try(act).finally(() => {
			mocked.mock.restore();
			syncBuiltinESMExports();
		});
	};
	await run("on", WORK);
	fake.setNow(new Date(NOW.getTime() + DAY));
	await taken(sweep);
	assert.deepEqual([notices(), state(), readdirSync(folder).filter((name) => name.startsWith("silent"))], [[], undefined, []]);
	await run("on", WORK);
	assert.deepEqual(await taken(() => run("off")), [0, "silent: off"]);
	assert.equal(state(), undefined);
});

test("--until without --recommend: from the shell and the phone, each on's own; a time that is none is refused and nothing written; another bound alone is the usage", async (t) => {
	const { fake, run, route, state } = await setup(t);
	assert.deepEqual(await run("on", WORK, "--until", "noon"), [1, "arthur silent: refused: --until noon: a time of day, HH:MM"]);
	assert.equal(await route(`/silent on ${WORK} --until 24:00`), "silent: refused: --until 24:00: a time of day, HH:MM");
	for (const args of [["--until"], ["--until", "09:00", "--until", "10:00"], ["--usage", "80"], ["--tickets", "AR0207"], ["--until", "09:00", "--usage", "80"]]) assert.deepEqual(await run("on", WORK, ...args), [2, USAGE], args.join(" "));
	assert.equal(state(), undefined);
	assert.equal(await route(`/silent on ${WORK} --until 18:30`), "silent: on until 18:30 on mon 2026-10-19");
	assert.deepEqual(state(), { since: NOW.toISOString(), seq: 2, work: WORK, until: "2026-10-19T16:30:00.000Z" }, "the flag is no part of the work");
	fake.setNow(new Date("2026-10-19T12:00:00Z"));
	assert.deepEqual(await run("on", "--until", "10:00", WORK), [0, "silent: on until 10:00 on tue 2026-10-20"], "10:00 today is past: the next one");
	assert.deepEqual(state(), { since: NOW.toISOString(), seq: 2, work: WORK, until: "2026-10-20T08:00:00.000Z" });
	assert.equal(await route("/silent on two  spaces"), "silent: on until 14:00 on tue 2026-10-20");
	assert.equal(state()?.work, "two  spaces", "without a flag the phone's work is the text as written");
});

test("through the coordinator: while on, a turn of only a wake is held, a wake and an owner message in one turn are answered", { skip: NO_UNIX_SOCKET }, async (t) => {
	const steps: AgentStep[] = [{ prompt: true }, { message: "Held reply." }, { end: true }, { prompt: true }, { message: "Sent reply." }, { end: true }, { prompt: true }];
	const agent = fakeAgent({ steps });
	const socket = join(temporaryFolder(), "tmux.sock");
	const options = { coordinator: { exitWaitSeconds: 1, restartDelaySeconds: 1, tmux: { session: "coord", socket } } };
	t.mock.method(console, "log", () => {});
	t.mock.method(console, "error", () => {});
	const fake = fakeHost({ name: "orchestration" });
	const plugin = orchestration(options);
	await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	t.after(() => void (process.env.PATH = PATH));
	endCoordinator(t, socket, plugin);
	await fake.commands.find((command) => command.name === "silent")?.run({ args: ["on", WORK], project: undefined });
	process.env.PATH = `${dirname(agent)}${delimiter}${PATH}`;
	await plugin.start?.();
	const held = join(fake.host.folder, "outbox", "held");
	fake.emit("coordinator-message", { text: "Schedule: the nightly audit ran." });
	await until("the held reply", () => existsSync(held) && readdirSync(held).length === 1);
	const wake = fake.emit("coordinator-message", { text: "Schedule: the backup ran." }).seq;
	const owner = fake.emit("message-received", { channel: "telegram", parts: [{ kind: "text", text: "How is it going?", mime: "text/plain" }] }).seq;
	const replies = () => fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => event.data);
	await until("the sent reply", () => replies().length === 1);
	assert.deepEqual(replies(), [{ text: sent("Sent reply.")[0], answers: [wake, owner], channels: ["telegram"] }]);
	assert.equal(JSON.parse(readFileSync(join(held, readdirSync(held)[0] ?? ""), "utf8")).text, "Held reply.");
});

// The grant's tests: the plugin on a fake host at NOW, 10:00 on mon 2026-10-19 in Warsaw, outside any job, with project acme
// (AC0001 and AC0002 on its board). `ask` is `arthur decision ask --kind question` of two options, Blue and Red, with `args`.
async function granting(t: TestContext) {
	const saved = process.env.ARTHUR_JOB;
	delete process.env.ARTHUR_JOB;
	t.after(() => (saved === undefined ? delete process.env.ARTHUR_JOB : (process.env.ARTHUR_JOB = saved)));
	const acme = temporaryFolder();
	execFileSync("git", ["init", "--quiet", acme]);
	const board = ["AC0001", "AC0002"].map((id) => ({ id, title: id, status: "planning", path: `spec/features/${id}-x/ticket.md`, updated: "2026-01-01T00:00:00Z" }));
	for (const { id, path } of board) {
		mkdirSync(dirname(join(acme, path)), { recursive: true });
		writeFileSync(join(acme, path), `# ${id} - X\n\n## Goal\n\nX.\n`);
	}
	writeFileSync(join(acme, "spec/build.json"), JSON.stringify(board));
	const fake = fakeHost({ name: "orchestration", timeZone: "Europe/Warsaw", now: NOW });
	fake.provide("projects", () => [{ name: "acme", path: acme, prefix: "AC" }]);
	await fake.setup(orchestration());
	const printed: string[] = [];
	t.mock.method(console, "log", (text: string) => void printed.push(text));
	t.mock.method(console, "error", (text: string) => void printed.push(text));
	const run = async (name: string, args: readonly string[]) => {
		printed.length = 0;
		const code = await fake.commands.find((command) => command.name === name)?.run({ args, project: undefined });
		return [code ?? 0, printed.join("\n")] as const;
	};
	const file = join(acme, "spec/decisions.jsonl");
	let said = 0;
	return {
		fake,
		silent: (...args: string[]) => run("silent", args),
		// `/silent <args>` from the owner's phone: its reply.
		phone: (...args: string[]) => fake.host.commands.route(`/silent ${args.join(" ")}`),
		// An answer comes with the owner's own message holding its words and id (AR0664).
		decision: (...args: string[]) => {
			if (args[0] === "answer") ownerSaid(fake.host.folder, ++said, args.join(" "));
			return run("decision", args);
		},
		ask: (...args: string[]) => run("decision", ["ask", "--kind", "question", "--question", "Blue or red?", "--option", "Blue", "--option", "Red", ...args]),
		log: () => (existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []),
		state: () => (existsSync(join(fake.host.folder, "silent.json")) ? JSON.parse(readFileSync(join(fake.host.folder, "silent.json"), "utf8")) : undefined),
		grant: () => `G${fake.emitted.findLast((event) => event.name === "silent-grant")?.seq}`,
		async context() {
			printed.length = 0;
			await fake.commands.find((command) => command.name === "coordinator")?.run({ args: ["context"], project: undefined });
			return printed.join("\n").split("\n\n## Silent\n\n")[1]?.split("\n\n")[0];
		},
	};
}

const ANSWERED = (id: string, grant: string, decided: string) => `${id}\n${id} answered by recommendation (${grant}): ${decided}; act on it as on the owner's answer, and say so in your reply`;
const NEVER = "never a plan question, a merge question, a budget question or a class's proposal";

test("a grant with --until answers an ask with --recommend by its recommendation, an option's or its words, until that time; an ask without --recommend waits", async (t) => {
	const { fake, phone, ask, log, state, grant, context } = await granting(t);
	const said = await phone("on", WORK, "--until", "12:00", "--recommend");
	const id = grant();
	assert.equal(said, `silent: on until 12:00 on mon 2026-10-19; the owner's grant ${id}: an arthur decision ask with --recommend is answered by its recommendation until 12:00 on mon 2026-10-19; ${NEVER}`);
	assert.deepEqual(fake.emitted.find((event) => event.name === "silent-grant")?.data, { work: WORK, until: "2026-10-19T10:00:00.000Z" });
	assert.deepEqual(state(), { since: NOW.toISOString(), seq: 1, work: WORK, until: "2026-10-19T10:00:00.000Z", grant: { id, until: "2026-10-19T10:00:00.000Z" } }, "seq: the phone command's own event; the grant's --until is the mode's end");
	assert.equal(await context(), `On since 10:00 on mon 2026-10-19, for: ${WORK}. ${ENDS("12:00 on mon 2026-10-19")}\nWhile it holds, the owner's grant ${id}: an arthur decision ask with --recommend is answered by its recommendation until 12:00 on mon 2026-10-19; ${NEVER}.`);
	assert.deepEqual(await ask("--recommend", "1"), [0, ANSWERED("AC-D1", id, "Blue")]);
	assert.deepEqual(log().at(-1), { record: "answer", id: "AC-D1", time: "2026-10-19T10:00:00+02:00", decided: "Blue", words: `by recommendation: ${id}` }, "no --picked: never scored as the owner's pick");
	assert.deepEqual(await ask("--recommend", "Red, the brand's"), [0, ANSWERED("AC-D2", id, "Red, the brand's")]);
	assert.deepEqual(await ask(), [0, "AC-D3"], "no recommendation, nothing to answer by");
	fake.setNow(new Date("2026-10-19T09:59:59Z"));
	assert.deepEqual(await ask("--recommend", "2"), [0, ANSWERED("AC-D4", id, "Red")]);
	fake.setNow(new Date("2026-10-19T10:00:00Z"));
	assert.deepEqual(await ask("--recommend", "2"), [0, "AC-D5"], "12:00 is past the grant");
	assert.deepEqual(log().filter((each) => each.record === "answer").map((each) => each.id), ["AC-D1", "AC-D2", "AC-D4"]);
});

// AR0664: the coordinator's shell could give itself the grant; only the owner's `/silent` gives it.
test("arthur silent on --recommend from a shell is refused in every form, writing nothing; the phone's grant holds", async (t) => {
	const { fake, silent, phone, state } = await granting(t);
	const refused = [1, "arthur silent: refused: --recommend is the owner's grant: he gives it on his phone, /silent on <the work> --until <HH:MM> --recommend"];
	for (const args of [["--until", "12:00", "--recommend"], ["--recommend"], ["--tickets", "AC0001", "--recommend"], ["--until", "noon", "--recommend"]]) {
		assert.deepEqual(await silent("on", WORK, ...args), refused, args.join(" "));
	}
	assert.deepEqual([state(), fake.emitted.filter((event) => event.name === "silent-grant")], [undefined, []]);
	await phone("on", WORK, "--until", "12:00", "--recommend");
	assert.deepEqual(await silent("on", WORK, "--until", "13:00", "--recommend"), refused);
	assert.deepEqual(state().grant?.until, "2026-10-19T10:00:00.000Z", "a refused shell grant leaves the phone's as it is");
});

test("a grant with --usage holds while models.usage reads under that percent; none, or no reading, answers nothing; it ends with the mode, 24 hours on", async (t) => {
	const { fake, phone, ask, state, grant } = await granting(t);
	assert.equal(await phone("on", WORK, "--usage", "80", "--recommend"), "silent: refused: --usage needs the models plugin, which reads the usage (models.usage)");
	assert.equal(state(), undefined, "nothing written");
	let used: number | null | undefined = 79.5;
	fake.provide("models.usage", () => used);
	assert.match(await phone("on", WORK, "--usage", "80", "--recommend"), /^silent: on until 10:00 on tue 2026-10-20; the owner's grant /);
	assert.deepEqual([state().until, state().grant], [END, { id: grant(), usage: 80 }]);
	assert.deepEqual(await ask("--recommend", "1"), [0, ANSWERED("AC-D1", grant(), "Blue")]);
	used = 80;
	assert.deepEqual(await ask("--recommend", "1"), [0, "AC-D2"], "80% is not under 80%");
	used = undefined;
	assert.deepEqual(await ask("--recommend", "1"), [0, "AC-D3"], "no usage report");
	used = null;
	assert.deepEqual(await ask("--recommend", "1"), [0, "AC-D4"], "a reading that is no number");
	used = 10;
	fake.setNow(new Date(NOW.getTime() + DAY - 1));
	assert.deepEqual(await ask("--recommend", "1"), [0, ANSWERED("AC-D5", grant(), "Blue")], "a millisecond before the mode's end");
	fake.setNow(new Date(NOW.getTime() + DAY));
	assert.deepEqual(await ask("--recommend", "1"), [0, "AC-D6"], "at the mode's end, before any sweep turned it off");
});

test("a grant with --tickets answers only an ask of one of its tickets", async (t) => {
	const { phone, ask, grant } = await granting(t);
	assert.equal(await phone("on", WORK, "--tickets", "ac0001,AC0099", "--recommend"), `${ON}; the owner's grant ${grant()}: an arthur decision ask with --recommend is answered by its recommendation for AC0001, AC0099; ${NEVER}`);
	assert.deepEqual(await ask("--recommend", "1", "--ticket", "AC0001"), [0, ANSWERED("AC-D1", grant(), "Blue")]);
	assert.deepEqual(await ask("--recommend", "1", "--ticket", "AC0002"), [0, "AC-D2"], "another ticket");
	assert.deepEqual(await ask("--recommend", "1"), [0, "AC-D3"], "no ticket");
});

test("a grant never answers a plan question, a merge question, a budget question, a class's proposal, or a question a class answers or two classes match; its answer backs no class", async (t) => {
	const { phone, decision, ask, log, grant } = await granting(t);
	await phone("on", WORK, "--until", "23:00", "--recommend");
	const merge = (...what: string[]) => decision("ask", "--kind", "merge", "--question", "Merge AC0001?", "--option", "Merge", "--recommend", "1", ...what);
	assert.deepEqual(await merge("--ticket", "AC0001", "--what", "--unreviewed"), [0, "AC-D1"]);
	assert.deepEqual(await merge("--ticket", "AC0001", "--what", "--no-ci"), [0, "AC-D2"]);
	assert.deepEqual(await merge(), [0, "AC-D3"], "arthur take-main's question names no flag, and is the owner's too");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Run AC0001 with no money limit?", "--ticket", "AC0001", "--option", "Yes", "--recommend", "1"), [0, "AC-D4"]);
	// The owner's own answer backs a class; its proposal, recommended 1, stays his.
	assert.deepEqual(await ask(), [0, "AC-D5"]);
	await decision("answer", "AC-D5", "--decided", "Blue", "--picked", "1", "blue");
	assert.equal((await decision("class", "propose", "--kind", "question", "--match", "blue red", "--decided", "Blue", "--backed-by", "AC-D5"))[0], 0);
	assert.deepEqual(log().filter((each) => each.id === "AC-D6").map((each) => each.record), ["ask"], "the proposal is not answered");
	await decision("answer", "AC-D6", "--picked", "1", "--decided", "Pre-approve blue", "AC-D6 yes");
	assert.deepEqual(await ask("--recommend", "2"), [0, "AC-D7\nAC-D7 answered by policy (AC-D6): Blue; act on it as on the owner's answer, and say so in your reply"], "the class, not the recommendation");
	await decision("class", "propose", "--kind", "question", "--match", "red", "--decided", "Blue", "--backed-by", "AC-D5");
	await decision("answer", "AC-D8", "--picked", "1", "--decided", "Pre-approve blue again", "AC-D8 yes");
	assert.deepEqual(await ask("--recommend", "2"), [0, "AC-D9\nAC-D9 goes to the owner: it matches classes AC-D6 and AC-D8"]);
	assert.deepEqual(await decision("ask", "--kind", "question", "--question", "Green or yellow?", "--option", "Green", "--recommend", "1"), [0, ANSWERED("AC-D10", grant(), "Green")]);
	assert.deepEqual(await decision("class", "propose", "--kind", "question", "--match", "green", "--decided", "Green", "--backed-by", "AC-D10"), [1, `arthur decision class propose: refused: AC-D10 was answered by recommendation (${grant()}), not by the owner`]);
	// AR-D603: a plan question always goes to the owner, while the grant holds and recommends its approval.
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Approve the plan of AC0001?", "--option", "Approve", "--recommend", "1", "--ticket", "AC0001"), [0, "AC-D11"]);
	assert.deepEqual(log().filter((each) => each.record === "answer" && each.words.startsWith("by recommendation")).map((each) => each.id), ["AC-D10"]);
});

test("a grant ends with arthur silent off, an on without --recommend and /silent on; a hand-edited grant answers nothing", async (t) => {
	const { fake, silent, phone, ask, state, context } = await granting(t);
	for (const end of [() => silent("off"), () => silent("on", WORK), () => phone("on the rest")]) {
		await phone("on", WORK, "--until", "23:00", "--recommend");
		assert.notEqual(state()?.grant, undefined);
		await end();
		assert.equal(state()?.grant, undefined);
		assert.equal((await ask("--recommend", "1"))[1].includes("answered"), false);
	}
	const file = join(fake.host.folder, "silent.json");
	for (const grant of [{ id: 7 }, { id: "G1", tickets: "AC0001" }, { id: "G1", until: "soon" }, { id: "G1", usage: "80" }]) {
		writeFileSync(file, JSON.stringify({ since: NOW.toISOString(), seq: 0, work: WORK, grant }));
		assert.equal(await context(), `On: ${file} does not parse, so it counts as on; \`arthur silent off\` removes it.`, JSON.stringify(grant));
		assert.equal((await ask("--recommend", "1"))[1].includes("answered"), false, JSON.stringify(grant));
	}
});

test("a grant is refused without a bound or with one it cannot hold, writing nothing; a bound but --until without --recommend is the usage", async (t) => {
	const { fake, phone, state } = await granting(t);
	fake.provide("models.usage", () => 10);
	const refused = (why: string) => `silent: refused: ${why}`;
	assert.equal(await phone("on", WORK, "--recommend"), refused("--recommend needs a bound: --until <HH:MM>, --usage <percent> or --tickets <id>,..."));
	for (const until of ["24:00", "9:00", "noon"]) assert.equal(await phone("on", WORK, "--until", until, "--recommend"), refused(`--until ${until}: a time of day, HH:MM`));
	for (const usage of ["0", "101", "1.5", "abc"]) assert.equal(await phone("on", WORK, "--usage", usage, "--recommend"), refused(`--usage ${usage}: a whole percent from 1 to 100`));
	for (const tickets of ["AC0001,", "AC-1", ","]) assert.equal(await phone("on", WORK, "--tickets", tickets, "--recommend"), refused(`--tickets ${tickets}: ticket ids, comma-separated`));
	assert.equal(state(), undefined);
	const usage = USAGE.replace("arthur silent", "/silent");
	for (const args of [["--usage", "50"], ["--tickets", "AC0001"], ["--recommend", "--recommend", "--until", "12:00"], ["--recommend", "--until", "12:00", "--until", "13:00"], ["--recommend", "--until"]]) {
		assert.equal(await phone("on", WORK, ...args), usage, args.join(" "));
	}
	assert.equal(state(), undefined);
	assert.match(await phone("on", WORK, "--usage", "100", "--recommend"), /^silent: on until 10:00 on tue 2026-10-20; the owner's grant /, "100% is a bound");
});

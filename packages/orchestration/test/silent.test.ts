import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentStep, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";
import { endCoordinator } from "./coordinator-end.ts";
import { NO_UNIX_SOCKET } from "./unix-socket.ts";

// The silent mode (spec/roadmap.md, entry 47, AR0127): `arthur silent` and `/silent`, its state file, the replies and notices it
// holds, and its line in the coordinator's context.

const PATH = process.env.PATH ?? "";
const NOW = new Date("2026-10-19T08:00:00Z");
const WORK = "AR0207 to AR0209 merged; stop at $20";

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// The plugin set up on a fake host in Warsaw, its coordinator not started; `silent.json` written before the setup when given,
// as an earlier process left it. `run` is `arthur silent <args>`, its exit code and what it printed; `stop` sweeps the outbox.
async function setup(t: TestContext, before?: string) {
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", root]);
	const fake = fakeHost({ name: "orchestration", root, timeZone: "Europe/Warsaw", now: NOW });
	if (before !== undefined) writeFileSync(join(fake.host.folder, "silent.json"), before);
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
		async run(...args: string[]) {
			printed.length = 0;
			const code = await fake.commands.find((command) => command.name === "silent")?.run({ args, project: undefined });
			return [code ?? 0, printed.join("\n")] as const;
		},
		route: (text: string) => fake.host.commands.route(text),
		silent: (notice: unknown) => fake.call<boolean>("coordinator.silent", notice),
		state: () => (existsSync(join(folder, "silent.json")) ? (JSON.parse(readFileSync(join(folder, "silent.json"), "utf8")) as { since: string; seq: number; work: string }) : undefined),
		// A reply as the inbox extension writes it, named after the time it was written.
		reply(text: string, channels: readonly string[], at = Date.now()) {
			mkdirSync(join(folder, "outbox"), { recursive: true });
			writeFileSync(join(folder, "outbox", `${at}-${String(++written).padStart(6, "0")}.json`), JSON.stringify({ text, answers: [written], channels }));
		},
		sweep: () => plugin.stop?.(),
		replied: () => fake.emitted.filter((event) => event.name === "coordinator-replied").map((event) => (event.data as { text: string }).text),
		held: () => (existsSync(join(folder, "outbox", "held")) ? readdirSync(join(folder, "outbox", "held")).length : 0),
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
	assert.equal(await route("/silent"), "silent: on");
	const on = state();
	assert.deepEqual(on, { since: NOW.toISOString(), seq: 1, work: "" }, "the event before it is not part of it");
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
	assert.equal(await route("/silent on"), "silent: on");
	assert.equal(await route("/silent off"), "silent: off, nothing happened meanwhile");
});

test("arthur silent on while on keeps since when and replaces the work; the context names both", async (t) => {
	const { fake, run, state, context } = await setup(t);
	assert.equal(await context(), undefined, "no section while off");
	assert.deepEqual(await run("on", "AR0207 merged"), [0, "silent: on"]);
	fake.setNow(new Date("2026-10-19T09:30:00Z"));
	fake.emit("notice", { text: "later" });
	assert.deepEqual(await run("on", WORK), [0, "silent: on"]);
	assert.deepEqual(state(), { since: NOW.toISOString(), seq: 0, work: WORK });
	assert.equal(await context(), `On since 10:00 on mon 2026-10-19, for: ${WORK}.`);
	assert.deepEqual(await run("off"), [0, "silent: off, meanwhile: 1 notice held:\n- later"], "what came after the first on");
	assert.deepEqual(await run("on"), [0, "silent: on"]);
	assert.equal(await context(), "On since 11:30 on mon 2026-10-19, for: nothing named; the owner turned it on.");
});

test("arthur silent off while off answers silent: off and changes nothing; a wrong word is the usage", async (t) => {
	const { folder, run, route } = await setup(t);
	const before = readdirSync(folder).sort();
	assert.deepEqual(await run("off"), [0, "silent: off"]);
	assert.deepEqual(await run("ask"), [0, "silent: off"]);
	assert.deepEqual(readdirSync(folder).sort(), before);
	const usage = "usage: arthur silent [on '<the work; its stop condition>' | off | ask]";
	assert.deepEqual(await run("loud"), [2, usage]);
	assert.deepEqual(await run("off", "now"), [2, usage]);
	assert.equal(await route("/silent please"), "usage: /silent [on '<the work; its stop condition>' | off | ask]");
	assert.deepEqual(readdirSync(folder).sort(), before);
});

test("coordinator.silent holds every notice while on, but the one of a job blocked on the owner", async (t) => {
	const { run, silent } = await setup(t);
	const ordinary = { text: "the coordinator's last 3 turns ended without a reply" };
	const blocked = { text: "AR1 asks: may I?", blocked: "2026-10-19-worker-00000001" };
	assert.deepEqual([silent(ordinary), silent(blocked)], [false, false], "off: nothing is held");
	await run("on", WORK);
	assert.deepEqual([silent(ordinary), silent(blocked), silent(undefined)], [true, false, true]);
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
	assert.deepEqual(replied(), ["Your answer."]);
	assert.equal(held(), 2);
	assert.deepEqual(await run("ask"), [0, "silent: on; the reply of this turn goes to the owner"]);
	reply("Before the ask, swept after it.", [], Date.now() - 1000);
	reply("A decision for you.", [], Date.now() + 1);
	reply("The next wake.", [], Date.now() + 2);
	await sweep();
	assert.deepEqual(replied(), ["Your answer.", "A decision for you."]);
	assert.equal(existsSync(join(folder, "silent-ask")), false, "one ask, one reply");
	assert.equal(held(), 4);
	await run("off");
	reply("Done: all merged.", []);
	await sweep();
	assert.deepEqual(replied(), ["Your answer.", "A decision for you.", "Done: all merged."]);
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

test("a restart while on: still on, the context says so, held replies stay held and the next one is held too", async (t) => {
	const state = JSON.stringify({ since: "2026-10-19T06:15:00.000Z", seq: 0, work: WORK });
	const { folder, reply, sweep, replied, held, context, silent } = await setup(t, state);
	mkdirSync(join(folder, "outbox", "held"), { recursive: true });
	writeFileSync(join(folder, "outbox", "held", "1-000001.json"), JSON.stringify({ text: "Held before.", answers: [1], channels: [] }));
	assert.equal(await context(), `On since 08:15 on mon 2026-10-19, for: ${WORK}.`);
	reply("After the restart.", []);
	await sweep();
	assert.deepEqual(replied(), []);
	assert.equal(held(), 2);
	assert.equal(silent({ text: "x" }), true);
});

test("a state file that does not parse counts as on, its context line names it, and arthur silent off removes it", async (t) => {
	for (const broken of ["{ not json", JSON.stringify({ since: 5 }), "null"]) {
		const { folder, run, reply, sweep, replied, context, silent } = await setup(t, broken);
		const file = join(folder, "silent.json");
		assert.equal(await context(), `On: ${file} does not parse, so it counts as on; \`arthur silent off\` removes it.`, broken);
		assert.equal(silent({ text: "x" }), true);
		reply("Held.", []);
		await sweep();
		assert.deepEqual(replied(), []);
		assert.deepEqual(await run("off"), [0, `silent: off, ${file} did not parse, so what happened meanwhile is unknown`]);
		assert.equal(existsSync(file), false);
		assert.equal(await context(), undefined);
	}
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
	assert.deepEqual(replies(), [{ text: "Sent reply.", answers: [wake, owner], channels: ["telegram"] }]);
	assert.equal(JSON.parse(readFileSync(join(held, readdirSync(held)[0] ?? ""), "utf8")).text, "Held reply.");
});

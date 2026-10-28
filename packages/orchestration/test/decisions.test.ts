import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";

// The decision log (spec/roadmap.md, entry 96): `arthur decision`, `arthur decisions`, the ticket's Decisions line, the plugin's
// own records, and the open questions in the coordinator's context.

const CLI = fileURLToPath(import.meta.resolve("@arthur/core/cli"));
const PLUGIN = fileURLToPath(new URL("../src/orchestration.ts", import.meta.url));
// 06:00 in Warsaw, which is UTC+1 in March.
const NOW = new Date("2026-03-04T05:00:00Z");
const PLAN = "spec/features/AC0001-plan/ticket.md";
const BARE = "spec/features/AC0002-bare/ticket.md";
const PLAN_TEXT = "# AC0001 - Plan\n\n## Goal\n\nA plan.\n\n## Decisions\n\n- 2026-01-01: Started.\n\n## Notes\n\nKept.\n";
const BARE_TEXT = "# AC0002 - Bare\n\n## Goal\n\nNo decisions yet.\n";
const JOB = "2026-03-04-worker-0000abcd";

type Ran = readonly [number, string];

// Two projects, acme (AC: AC0001 with Decisions and a section after it, AC0002 without) and shop (SH: SH0001), the plugin set
// up on the fake host in Warsaw, outside any job; `env` stands for the env file's values, the host's `secrets`.
async function setup(t: TestContext, env: Record<string, string> = {}) {
	const saved = process.env.ARTHUR_JOB;
	delete process.env.ARTHUR_JOB;
	t.after(() => (saved === undefined ? delete process.env.ARTHUR_JOB : (process.env.ARTHUR_JOB = saved)));
	const base = temporaryFolder();
	const [acme, shop] = [join(base, "acme"), join(base, "shop")];
	const entry = (id: string, path: string) => ({ id, title: id, status: "planning", path, updated: "2026-01-01T00:00:00Z" });
	for (const [path, text] of [
		[join(acme, PLAN), PLAN_TEXT],
		[join(acme, BARE), BARE_TEXT],
		[join(acme, "spec/build.json"), JSON.stringify([entry("AC0001", PLAN), entry("AC0002", BARE)])],
		[join(shop, "spec/features/SH0001-shop/ticket.md"), "# SH0001 - Shop\n"],
		[join(shop, "spec/build.json"), JSON.stringify([entry("SH0001", "spec/features/SH0001-shop/ticket.md")])],
	] as const) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, text);
	}
	// The coordinator's context reads each project's prompt, which needs its repository.
	for (const root of [acme, shop]) execFileSync("git", ["init", "--quiet", root]);
	const projects = [{ name: "acme", path: acme, prefix: "AC" }, { name: "shop", path: shop, prefix: "SH" }];
	const fake = fakeHost({ name: "orchestration", timeZone: "Europe/Warsaw", now: NOW, env });
	fake.provide("projects", () => projects);
	await fake.setup(orchestration());
	const printed: string[] = [];
	t.mock.method(console, "log", (text: string) => void printed.push(text));
	t.mock.method(console, "error", (text: string) => void printed.push(text));
	const run = async (name: string, args: readonly string[], project?: string): Promise<Ran> => {
		printed.length = 0;
		const code = await fake.commands.find((command) => command.name === name)?.run({ args, project });
		return [code ?? 0, printed.join("\n")];
	};
	const file = (root = acme) => join(root, "spec/decisions.jsonl");
	return {
		fake,
		printed,
		acme,
		shop,
		projects,
		file,
		decision: (...args: string[]) => run("decision", args),
		decisions: (...args: string[]) => run("decisions", args),
		run,
		log: (root = acme) => (existsSync(file(root)) ? readFileSync(file(root), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : undefined),
		ticket: (path: string) => readFileSync(join(acme, path), "utf8"),
		async context() {
			printed.length = 0;
			await fake.commands.find((command) => command.name === "coordinator")?.run({ args: ["context"], project: undefined });
			return printed.join("\n").split("\n\n## Open decisions\n\n")[1]?.split("\n\n## Time\n\n")[0];
		},
		blocked: (id: string, question: string, ticket: string | null = "AC0001") => fake.emit("job-state", { id, project: "acme", ticket, machine: "local", from: "working", to: "blocked", reason: `user: ${question}` }),
		notices: () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text),
	};
}

const PLAN_ASK = ["ask", "--kind", "plan", "--question", "Approve the plan of AC0001?", "--ticket", "ac0001", "--option", "Approve", "--option", "Plan again", "--recommend", "1"];
const APPROVED = ["--decided", "Plan approved by the owner: plan.md at abc1234", "--picked", "1"];

test("an ask prints the next id of its project's prefix and records the question, options, recommendation and ticket, its time in timeZone", async (t) => {
	const { decision, log, shop } = await setup(t);
	assert.deepEqual(await decision(...PLAN_ASK), [0, "AC-D1"]);
	assert.deepEqual(await decision("ask", "--kind", "question", "--question", "Which colour for the menu?", "--recommend", "blue, the brand's", "--job", JOB), [0, "AC-D2"]);
	assert.deepEqual(log(), [
		{ record: "ask", id: "AC-D1", time: "2026-03-04T06:00:00+01:00", project: "acme", kind: "plan", question: "Approve the plan of AC0001?", options: ["Approve", "Plan again"], recommend: 1, ticket: "AC0001" },
		{ record: "ask", id: "AC-D2", time: "2026-03-04T06:00:00+01:00", project: "acme", kind: "question", question: "Which colour for the menu?", options: [], recommend: "blue, the brand's", job: JOB },
	]);
	const { run } = await setup(t);
	assert.deepEqual(await run("decision", ["ask", "--kind", "budget", "--question", "Raise the budget?"], "shop"), [0, "SH-D1"], "--project acts on shop's log");
	assert.equal(log(shop)?.length, undefined, "the first setup's shop has no log");
});

test("an ask is refused, naming why and writing nothing: an empty question, another kind, a ticket not on the board, a recommendation with no such option", async (t) => {
	const { decision, run, file } = await setup(t);
	const refused = (why: string): Ran => [1, `arthur decision ask: refused: ${why}`];
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "  "), refused("an empty question: --question <what the owner decides>"));
	assert.deepEqual(await decision("ask", "--kind", "plan"), refused("an empty question: --question <what the owner decides>"));
	assert.deepEqual(await decision("ask", "--kind", "vote", "--question", "Go?"), refused('kind "vote": one of job, question, plan, review, budget, merge'));
	assert.deepEqual(await decision("ask", "--question", "Go?"), refused('kind "": one of job, question, plan, review, budget, merge'));
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Go?", "--ticket", "AC0099"), refused("--ticket AC0099 is not on the board of project acme"));
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Go?", "--ticket", "SH0001"), refused("--ticket SH0001 is not on the board of project acme"));
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Go?", "--option", "a", "--option", "b", "--recommend", "3"), refused("--recommend 3: no such option; 2 offered (--option)"));
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Go?", "--recommend", "1"), refused("--recommend 1: no such option; 0 offered (--option)"));
	assert.deepEqual(await run("decision", ["ask", "--kind", "plan", "--question", "Go?"], "nowhere"), refused("unknown project nowhere; projects: acme, shop"));
	assert.equal(existsSync(file()), false);
	for (const args of [["ask", "--kind", "plan", "--question", "Go?", "extra"], ["ask", "--kind"], ["ask", "--kind", "plan", "--kind", "job", "--question", "Go?"], ["ask", "--color", "red"], ["vote"], [], ["answer"], ["close"]]) {
		const [code, said] = await decision(...args);
		assert.deepEqual([code, said.split("\n")[0]], [2, "usage: arthur decision ask --kind <kind> --question <text> [--ticket <id>] [--job <id>] [--what --unreviewed|--no-ci]... [--option <text>]... [--recommend <n or text>]"], args.join(" "));
	}
	assert.equal(existsSync(file()), false);
});

test("inside a job every arthur decision is refused and writes nothing; arthur decisions still reads", async (t) => {
	const { decision, decisions, file } = await setup(t);
	assert.deepEqual(await decision(...PLAN_ASK), [0, "AC-D1"]);
	const before = readFileSync(file(), "utf8");
	process.env.ARTHUR_JOB = "/home/arthur/.arthur/jobs/2026-03-04-worker-0000abcd";
	const refusal = "arthur decision: refused inside a job 2026-03-04-worker-0000abcd: a job never records the owner's word; end your run with Blocked: user <question> instead";
	for (const args of [PLAN_ASK, ["answer", "AC-D1", ...APPROVED, "ok"], ["close", "AC-D1", "gone"], ["vote"]]) assert.deepEqual(await decision(...args), [1, refusal], args[0]);
	assert.equal(readFileSync(file(), "utf8"), before);
	assert.deepEqual(await decisions(), [0, "AC-D1 2026-03-04 plan AC0001: Approve the plan of AC0001? — open"]);
});

// The job whose systemd scope runs this test, when one does (a job's own `npm test`).
const scope = /\/arthur-job-([^/]+)\.scope$/.exec(existsSync("/proc/self/cgroup") ? readFileSync("/proc/self/cgroup", "utf8").trimEnd() : "")?.[1];

test("in a job's scope arthur decision is refused with ARTHUR_JOB cleared once the home holds that job's record", { skip: scope === undefined && "not run in a job's systemd scope" }, async (t) => {
	const { decision, fake, file } = await setup(t);
	assert.deepEqual(await decision(...PLAN_ASK), [0, "AC-D1"], "the test's own home holds no record of the job");
	const before = readFileSync(file(), "utf8");
	mkdirSync(join(dirname(fake.host.folder), "jobs", scope ?? ""), { recursive: true });
	assert.deepEqual(await decision(...PLAN_ASK), [1, `arthur decision: refused inside a job ${scope}: a job never records the owner's word; end your run with Blocked: user <question> instead`]);
	assert.equal(readFileSync(file(), "utf8"), before);
});

test("an answer goes into the log, then under its ticket's Decisions in the form the plan check reads; a second answer adds a line and counts", async (t) => {
	const { decision, decisions, fake, log, ticket } = await setup(t);
	await decision(...PLAN_ASK);
	assert.deepEqual(await decision("answer", "ac-d1", ...APPROVED, "ok,", "go"), [0, "AC-D1 answered: Plan approved by the owner: plan.md at abc1234; its line is under the Decisions of AC0001"]);
	assert.deepEqual(log()?.[1], { record: "answer", id: "AC-D1", time: "2026-03-04T06:00:00+01:00", decided: "Plan approved by the owner: plan.md at abc1234", picked: 1, words: "ok, go" });
	const first = '- 2026-03-04: Plan approved by the owner: plan.md at abc1234; the owner: "ok, go" (AC-D1)';
	assert.equal(ticket(PLAN), PLAN_TEXT.replace("- 2026-01-01: Started.\n", `- 2026-01-01: Started.\n${first}\n`));
	// plans.ts's APPROVED, which the worker's spawn check reads.
	assert.match(first, /^- \d{4}-\d\d-\d\d: Plan approved by the owner: plan\.md at ([0-9a-f]{7,40})\b/);
	fake.setNow(new Date("2026-03-05T22:30:00Z"));
	assert.equal((await decision("answer", "AC-D1", "--decided", "Plan the ticket again", "--picked", "2", "no,", "wait"))[0], 0);
	const second = '- 2026-03-05: Plan the ticket again; the owner: "no, wait" (AC-D1)';
	assert.equal(ticket(PLAN), PLAN_TEXT.replace("- 2026-01-01: Started.\n", `- 2026-01-01: Started.\n${first}\n${second}\n`), "the date in Warsaw, already the 5th");
	assert.equal(log()?.length, 3, "both answers kept");
	assert.deepEqual(await decisions(), [0, "AC-D1 2026-03-04 plan AC0001: Approve the plan of AC0001? — answered 2026-03-05: Plan the ticket again"]);
	assert.match((await decisions("AC-D1"))[1], /\nNow: answered, the later answer counts$/);
});

test("a question of no ticket stays in the log only; a ticket without Decisions gets the heading", async (t) => {
	const { decision, log, ticket } = await setup(t);
	await decision("ask", "--kind", "question", "--question", "Deploy on Friday?");
	assert.deepEqual(await decision("answer", "AC-D1", "--decided", "No deploys on Friday", "no"), [0, "AC-D1 answered: No deploys on Friday; a question of no ticket: the log only"]);
	assert.equal(log()?.length, 2);
	assert.equal(ticket(PLAN), PLAN_TEXT);
	assert.equal(ticket(BARE), BARE_TEXT);
	await decision("ask", "--kind", "question", "--question", "Keep it small?", "--ticket", "AC0002");
	assert.equal((await decision("answer", "AC-D2", "--decided", "Keep it small", "yes"))[0], 0);
	assert.equal(ticket(BARE), `${BARE_TEXT}\n## Decisions\n\n- 2026-03-04: Keep it small; the owner: "yes" (AC-D2)\n`);
});

test("an answer is refused, naming why and writing nothing: an unknown id, no words, no --decided, a --picked with no such option", async (t) => {
	const { decision, file, ticket } = await setup(t);
	await decision(...PLAN_ASK);
	await decision("ask", "--kind", "question", "--question", "Open?");
	const before = readFileSync(file(), "utf8");
	const refused = (why: string): Ran => [1, `arthur decision answer: refused: ${why}`];
	assert.deepEqual(await decision("answer", "AC-D9", ...APPROVED, "ok"), refused("AC-D9 is not in the decision log of project acme"));
	assert.deepEqual(await decision("answer", "ZZ-D1", ...APPROVED, "ok"), refused("ZZ-D1: no project has the prefix ZZ; prefixes: AC, SH"));
	assert.deepEqual(await decision("answer", "AC0001", ...APPROVED, "ok"), refused("AC0001 is no decision id: <prefix>-D<number>, as arthur decision ask printed it"));
	assert.deepEqual(await decision("answer", "SH-D1", ...APPROVED, "ok"), refused("SH-D1 is not in the decision log of project shop"));
	assert.deepEqual(await decision("answer", "AC-D1", ...APPROVED), refused("an empty answer: the owner's words, as he wrote or said them, after the flags"));
	assert.deepEqual(await decision("answer", "AC-D1", ...APPROVED, " "), refused("an empty answer: the owner's words, as he wrote or said them, after the flags"));
	assert.deepEqual(await decision("answer", "AC-D1", "ok"), refused("no --decided: the decision in one English line"));
	assert.deepEqual(await decision("answer", "AC-D1", "--decided", " ", "ok"), refused("no --decided: the decision in one English line"));
	assert.deepEqual(await decision("answer", "AC-D1", "--decided", "Go", "--picked", "3", "ok"), refused("--picked 3: no such option; AC-D1 offered 2"));
	assert.deepEqual(await decision("answer", "AC-D1", "--decided", "Go", "--picked", "0", "ok"), refused("--picked 0: no such option; AC-D1 offered 2"));
	assert.deepEqual(await decision("answer", "AC-D1", "--decided", "Go", "--picked", "first", "ok"), refused("--picked first: no such option; AC-D1 offered 2"));
	assert.deepEqual(await decision("answer", "AC-D2", "--decided", "Go", "--picked", "1", "ok"), refused("--picked 1: no such option; AC-D2 offered 0"));
	assert.equal(readFileSync(file(), "utf8"), before);
	assert.equal(ticket(PLAN), PLAN_TEXT);
});

test("a close ends an open question; an answer after it is still recorded and counts; closing again or an unknown id is refused", async (t) => {
	const { decision, decisions, log } = await setup(t);
	await decision(...PLAN_ASK);
	assert.deepEqual(await decision("close", "AC-D1", "the", "plan", "was", "dropped"), [0, "AC-D1 closed: the plan was dropped"]);
	assert.deepEqual(log()?.[1], { record: "close", id: "AC-D1", time: "2026-03-04T06:00:00+01:00", reason: "the plan was dropped" });
	const refused = (why: string): Ran => [1, `arthur decision close: refused: ${why}`];
	assert.deepEqual(await decision("close", "AC-D1", "again"), refused("AC-D1 is closed; a close ends an open question"));
	assert.deepEqual(await decision("close", "AC-D7", "why"), refused("AC-D7 is not in the decision log of project acme"));
	assert.deepEqual(await decision("close", "AC-D1"), refused("no reason: arthur decision close AC-D1 <reason>"));
	assert.deepEqual(await decisions("--open"), [0, "no decision matches"]);
	assert.equal((await decision("answer", "AC-D1", ...APPROVED, "approve it anyway"))[0], 0);
	assert.deepEqual(await decisions(), [0, "AC-D1 2026-03-04 plan AC0001: Approve the plan of AC0001? — answered 2026-03-04: Plan approved by the owner: plan.md at abc1234"]);
	assert.deepEqual(await decision("close", "AC-D1", "late"), refused("AC-D1 is answered; a close ends an open question"));
	assert.equal(log()?.length, 3);
});

test("the plugin closes an open question once what it waits on is gone: its job continued or ended, its ticket merged or dropped", async (t) => {
	const { decision, fake, log, blocked } = await setup(t);
	blocked(JOB, "May I drop the table?");
	blocked("2026-03-04-worker-0000ffff", "May I rename it?", null);
	await decision("ask", "--kind", "plan", "--question", "Approve?", "--ticket", "AC0001");
	await decision("ask", "--kind", "question", "--question", "Merge AC0002 first?", "--ticket", "AC0002");
	await decision("ask", "--kind", "question", "--question", "Answered.", "--ticket", "AC0002");
	await decision("answer", "AC-D5", "--decided", "Yes", "yes");
	const closes = () => (log() ?? []).filter((each) => each.record === "close").map((each) => [each.id, each.reason]);
	const state = (id: string, from: string, to: string) => fake.emit("job-state", { id, project: "acme", ticket: null, machine: "local", from, to, reason: "" });
	state("2026-03-04-worker-00000000", "blocked", "working");
	state(JOB, "working", "blocked");
	assert.deepEqual(closes(), [], "another job, or a block, closes nothing");
	state(JOB, "blocked", "working");
	state("2026-03-04-worker-0000ffff", "blocked", "ended");
	fake.emit("ticket-moved", { id: "AC0001", project: "acme", from: "planning", to: "planned" });
	assert.deepEqual(closes(), [["AC-D1", "job continued"], ["AC-D2", "job ended"]]);
	fake.emit("ticket-moved", { id: "AC0001", project: "acme", from: "in-progress", to: "merged" });
	fake.emit("ticket-moved", { id: "AC0002", project: "acme", from: "planning", to: "dropped" });
	state(JOB, "working", "idle");
	fake.emit("ticket-moved", { id: "AC0002", project: "acme", from: "planning", to: "dropped" });
	assert.deepEqual(closes(), [["AC-D1", "job continued"], ["AC-D2", "job ended"], ["AC-D3", "ticket merged"], ["AC-D4", "ticket dropped"]], "an answered question stays as it is, and each closes once");
});

test("a job blocked on the owner asks in the log: the notice and the wake name the id; blocked twice is two questions", async (t) => {
	const { fake, log, blocked, notices } = await setup(t);
	blocked(JOB, "May I drop the old orders table?");
	assert.deepEqual(notices(), [`${JOB} asks [AC-D1]: May I drop the old orders table?`]);
	assert.deepEqual(log(), [{ record: "ask", id: "AC-D1", time: "2026-03-04T06:00:00+01:00", project: "acme", kind: "job", question: "May I drop the old orders table?", options: [], job: JOB, ticket: "AC0001" }]);
	const wake = { id: JOB, kind: "worker", project: "acme", state: "blocked", reason: "user: May I drop the old orders table?" };
	assert.deepEqual(fake.collect("coordinator.wake", wake).filter(Boolean), [
		`Its question is decision AC-D1: record the owner's answer first, arthur decision answer AC-D1 --decided '<the decision in one line>' '<his words>', then arthur continue ${JOB} '<his answer>'.`,
	]);
	assert.deepEqual(fake.collect("coordinator.wake", { ...wake, state: "ended", reason: "finished" }).filter(Boolean), [], "a run that ended otherwise");
	fake.emit("job-state", { id: JOB, project: "acme", ticket: "AC0001", machine: "local", from: "blocked", to: "working", reason: "" });
	blocked(JOB, "And the archive too?", "AC0099");
	assert.deepEqual(notices().at(-1), `${JOB} asks [AC-D2]: And the archive too?`);
	assert.deepEqual(log()?.map((each) => [each.record, each.id, each.ticket]), [["ask", "AC-D1", "AC0001"], ["close", "AC-D1", undefined], ["ask", "AC-D2", undefined]], "a ticket not on the board is left out");
});

test("while another process holds the log's lock, a job's question and the closes wait for it without stalling the process", async (t) => {
	const { decision, fake, log, file, blocked, notices, printed } = await setup(t);
	const holder = spawn("sleep", ["60"]);
	t.after(() => holder.kill());
	const lock = join(fake.host.folder, "decisions-acme.lock");
	const until = async (what: string, done: () => boolean) => {
		for (const end = Date.now() + 5000; !done(); await sleep(10)) if (Date.now() > end) assert.fail(`no ${what} within 5 s`);
	};
	// Each emit returns at once; `withLock` would wait 10 s for the live holder, then fail.
	const held = (emit: () => void) => {
		writeFileSync(lock, String(holder.pid));
		const started = performance.now();
		emit();
		assert.ok(performance.now() - started < 1000, `the emit took ${performance.now() - started} ms`);
	};
	const wake = (question: string) => fake.collect("coordinator.wake", { id: JOB, kind: "worker", project: "acme", state: "blocked", reason: `user: ${question}` }).filter(Boolean);
	blocked(JOB, "May I drop the table?");
	await decision("answer", "AC-D1", "--decided", "Drop it", "yes");
	held(() => blocked(JOB, "And the archive?"));
	assert.deepEqual([notices(), log()?.length], [[`${JOB} asks [AC-D1]: May I drop the table?`], 2], "the notice waits for its question's id");
	assert.deepEqual(wake("And the archive?"), [
		`Its question was not in the decision log yet: arthur decisions --kind job --project acme shows its id. Open, record the owner's answer first, arthur decision answer <its id> --decided '<the decision in one line>' '<his words>', then arthur continue ${JOB} '<his answer>'; answered by policy, act on that decision as on the owner's answer, and say so in your reply.`,
	], "the job's earlier question, answered, is not taken for this one");
	assert.deepEqual(fake.collect("coordinator.wake", { id: JOB, kind: "worker", project: "elsewhere", state: "blocked", reason: "user: And the archive?" }).filter(Boolean), [], "a project not listed has no log to look in");
	rmSync(lock);
	await until("notice", () => notices().length === 2);
	assert.equal(notices()[1], `${JOB} asks [AC-D2]: And the archive?`);
	assert.deepEqual(wake("And the archive?"), [`Its question is decision AC-D2: record the owner's answer first, arthur decision answer AC-D2 --decided '<the decision in one line>' '<his words>', then arthur continue ${JOB} '<his answer>'.`]);
	await decision("ask", "--kind", "question", "--question", "Merge AC0002 first?", "--ticket", "AC0002");
	const closes = () => (log() ?? []).filter((each) => each.record === "close").map((each) => [each.id, each.reason]);
	held(() => {
		fake.emit("job-state", { id: JOB, project: "acme", ticket: "AC0001", machine: "local", from: "blocked", to: "working", reason: "" });
		fake.emit("ticket-moved", { id: "AC0002", project: "acme", from: "planning", to: "dropped" });
	});
	assert.deepEqual(closes(), []);
	rmSync(lock);
	await until("closes", () => closes().length === 2);
	assert.deepEqual(closes().toSorted(), [["AC-D2", "job continued"], ["AC-D3", "ticket dropped"]]);
	// A log broken by hand while they wait: the notice still goes, without an id, and each event fails, named.
	const [other, third] = ["2026-03-04-worker-0000ffff", "2026-03-04-worker-0000eeee"];
	await decision("ask", "--kind", "job", "--question", "Rename AC0001?", "--ticket", "AC0001", "--job", third);
	held(() => {
		blocked(other, "May I?");
		fake.emit("job-state", { id: third, project: "acme", ticket: "AC0001", machine: "local", from: "blocked", to: "ended", reason: "stopped" });
		fake.emit("ticket-moved", { id: "AC0001", project: "acme", from: "in-progress", to: "merged" });
	});
	appendFileSync(file(), "not json\n");
	printed.length = 0;
	rmSync(lock);
	await until("failures", () => printed.length === 3);
	assert.equal(notices().at(-1), `${other} asks: May I?`);
	assert.deepEqual(printed.map((line) => /^plugin orchestration: handler of (job-state|ticket-moved) \(event \d+\) failed: .* is not a decision record/.exec(line)?.[1]).toSorted(), ["job-state", "job-state", "ticket-moved"]);
});

test("a log line that is not a record refuses every write, naming the line and leaving the file as it is; the notice still goes", async (t) => {
	const { decision, decisions, file, blocked, notices, context, printed } = await setup(t);
	await decision(...PLAN_ASK);
	for (const [line, why] of [
		["not json", "not a JSON object"],
		['{"record":"answer","id":"AC-D4","time":"2026-03-04T06:00:00+01:00","decided":"Go","words":"go"}', "no ask of AC-D4 above it"],
		['{"record":"ask","id":"AC-D2","time":"2026-03-04T06:00:00+01:00","project":"acme","kind":"vote","question":"Go?","options":[]}', 'kind "vote"'],
		['{"record":"ask","id":"SH-D2","time":"2026-03-04T06:00:00+01:00","project":"acme","kind":"plan","question":"Go?","options":[]}', 'id "SH-D2", not AC-D<number>'],
		["", "not a JSON object"],
	]) {
		const text = `${readFileSync(file(), "utf8").split("\n")[0]}\n${line}\n{"record":"close","id":"AC-D1","time":"2026-03-04T06:00:00+01:00","reason":"x"}\n`;
		writeFileSync(file(), text);
		const named = `${file()} line 2 is not a decision record (${why}); only arthur decision writes the log: undo the hand edit (git diff -- spec/decisions.jsonl); nothing was written`;
		assert.deepEqual(await decision(...PLAN_ASK), [1, `arthur decision ask: refused: ${named}`], line);
		assert.deepEqual(await decision("answer", "AC-D1", ...APPROVED, "ok"), [1, `arthur decision answer: refused: ${named}`]);
		assert.deepEqual(await decision("close", "AC-D1", "gone"), [1, `arthur decision close: refused: ${named}`]);
		assert.deepEqual(await decisions(), [1, `arthur decisions: ${named}`]);
		assert.equal(readFileSync(file(), "utf8"), text);
	}
	assert.equal(await context(), `- project acme: its decision log was not read: ${file()} line 2 is not a decision record (not a JSON object); only arthur decision writes the log: undo the hand edit (git diff -- spec/decisions.jsonl); nothing was written`);
	printed.length = 0;
	blocked(JOB, "May I?");
	assert.match(printed.join("\n"), /^plugin orchestration: handler of job-state \(event \d+\) failed: .* line 2 is not a decision record/, "the event fails, named");
	assert.deepEqual(notices(), [`${JOB} asks: May I?`], "the notice went, naming no decision");
});

test("a crash between the log's line and the ticket's: the answer is kept, the line named missing, and the next arthur decision writes it once", async (t) => {
	const { decision, decisions, log, acme, ticket } = await setup(t);
	await decision(...PLAN_ASK);
	const folder = join(acme, dirname(PLAN));
	chmodSync(folder, 0o555);
	t.after(() => chmodSync(folder, 0o755));
	const [code, said] = await decision("answer", "AC-D1", ...APPROVED, "ok");
	assert.equal(code, 1);
	assert.match(said, /^AC-D1 answered: Plan approved by the owner: plan\.md at abc1234\narthur decision answer: a line under the Decisions of AC0001 was not written \(EACCES.*\); the next arthur decision writes it$/);
	assert.equal(log()?.length, 2, "the answer is in the log");
	assert.equal(ticket(PLAN), PLAN_TEXT);
	assert.match((await decisions())[1], /; its line under the Decisions of AC0001 is missing$/);
	chmodSync(folder, 0o755);
	assert.deepEqual(await decision("ask", "--kind", "question", "--question", "Next?"), [0, "AC-D2"]);
	const line = '- 2026-03-04: Plan approved by the owner: plan.md at abc1234; the owner: "ok" (AC-D1)';
	assert.equal(ticket(PLAN), PLAN_TEXT.replace("- 2026-01-01: Started.\n", `- 2026-01-01: Started.\n${line}\n`));
	await decision("ask", "--kind", "question", "--question", "And then?");
	assert.equal(ticket(PLAN).split(line).length, 2, "written once");
	assert.doesNotMatch((await decisions())[1], /missing/);
});

test("a Decisions line a human edited is named by arthur decisions and never rewritten", async (t) => {
	const { decision, decisions, acme, ticket } = await setup(t);
	await decision(...PLAN_ASK);
	await decision("answer", "AC-D1", ...APPROVED, "ok");
	const edited = ticket(PLAN).replace('"ok" (AC-D1)', '"ok, approved" (AC-D1)');
	writeFileSync(join(acme, PLAN), edited);
	await decision("ask", "--kind", "question", "--question", "Next?");
	assert.equal(ticket(PLAN), edited);
	assert.match((await decisions())[1], /^AC-D1 .* — answered 2026-03-04: Plan approved by the owner: plan\.md at abc1234; edited by hand under the Decisions of AC0001$/m);
	assert.match((await decisions("AC-D1"))[1], /\nEdited by hand under the Decisions of AC0001, kept as it is: - 2026-03-04: Plan approved .*"ok, approved" \(AC-D1\)$/);
});

test("a key, a job id and a commit hash in the owner's answer are redacted in the log and the ticket; the id, ticket and job are kept", async (t) => {
	const { decision, log, ticket, file } = await setup(t);
	const key = "sk-live-4f9a8b7c6d5e4f3a2b1c";
	process.env.ARTHUR_TEST_DECISION_TOKEN = "hunter2hunter2";
	t.after(() => delete process.env.ARTHUR_TEST_DECISION_TOKEN);
	await decision("ask", "--kind", "question", "--question", "Use hunter2hunter2?", "--ticket", "AC0001", "--job", JOB, "--option", `key ${key}`);
	await decision("answer", "AC-D1", "--decided", "Use the key hunter2hunter2", `yes, ${key}, see ${JOB} at 0123456789abcdef0123456789abcdef01234567`);
	const text = readFileSync(file(), "utf8");
	for (const secret of ["hunter2hunter2", key, "0123456789abcdef"]) assert.ok(!text.includes(secret) && !ticket(PLAN).includes(secret), secret);
	assert.deepEqual(log()?.[0], { record: "ask", id: "AC-D1", time: "2026-03-04T06:00:00+01:00", project: "acme", kind: "question", question: "Use [redacted]?", options: ["key [redacted]"], ticket: "AC0001", job: JOB });
	assert.equal(log()?.[1].words, "yes, [redacted], see [redacted] at [redacted]");
	assert.match(ticket(PLAN), /^- 2026-03-04: Use the key \[redacted\]; the owner: "yes, \[redacted\], see \[redacted\] at \[redacted\]" \(AC-D1\)$/m);
});

test("a value of the env file, which the process's environment never holds, is redacted in every text the log keeps; the wake still finds the job's question", async (t) => {
	const secret = "correct-horse-battery";
	// A value of 8 characters is a secret, one of 7 is not (`seventh`, `Drop` stay); a value that starts another is replaced after it.
	const { fake, decision, log, blocked, file } = await setup(t, { ARTHUR_ORCHESTRATION_PASS: secret, ARTHUR_ORCHESTRATION_WORD: "Drop", ARTHUR_ORCHESTRATION_SHORT: "abcdefgh", ARTHUR_ORCHESTRATION_LONG: "abcdefgh-longer-tail", ARTHUR_ORCHESTRATION_SEVEN: "seventh" });
	assert.ok(!Object.values(process.env).includes(secret));
	await backed(decision);
	await decision(...PROPOSE);
	await decision("answer", "AC-D4", ...APPROVE, "yes");
	await decision("ask", "--kind", "question", "--question", `Use ${secret}?`, "--option", `keep ${secret}`, "--recommend", `rotate ${secret}`);
	await decision("answer", "AC-D5", "--decided", `Rotate ${secret}`, `yes, ${secret}`);
	await decision("ask", "--kind", "question", "--question", "Drop abcdefgh-longer-tail, abcdefgh, seventh?");
	await decision("close", "AC-D6", `moot, ${secret}`);
	blocked(JOB, `May I print ${secret}?`);
	assert.deepEqual(await decision("class", "revoke", "AC-D4", `stop, ${secret}`), [0, "AC-D4 revoked: its questions go to the owner again"]);
	assert.ok(!readFileSync(file(), "utf8").includes(secret));
	const texts = (log() ?? []).slice(8).map(({ record, question, options, recommend, decided, words, reason }) => ({ record, question, options, recommend, decided, words, reason }));
	assert.deepEqual(JSON.parse(JSON.stringify(texts)), [
		{ record: "ask", question: "Use [redacted]?", options: ["keep [redacted]"], recommend: "rotate [redacted]" },
		{ record: "answer", decided: "Rotate [redacted]", words: "yes, [redacted]" },
		{ record: "ask", question: "Drop [redacted], [redacted], seventh?", options: [] },
		{ record: "close", reason: "moot, [redacted]" },
		{ record: "ask", question: "May I print [redacted]?", options: [] },
		{ record: "revoke", words: "stop, [redacted]" },
	]);
	assert.match(fake.collect<string>("coordinator.wake", { id: JOB, kind: "worker", project: "acme", state: "blocked", reason: `user: May I print ${secret}?` }).filter(Boolean)[0] ?? "", /^Its question is decision AC-D7:/);
});

test("a long answer cuts the ticket's line, naming arthur decisions <id>, which prints it whole", async (t) => {
	const { decision, decisions, log, ticket } = await setup(t);
	await decision(...PLAN_ASK);
	const words = `Yes. ${"Keep the old menu as it is for now and ship it. ".repeat(12)}Done.`;
	await decision("answer", "AC-D1", ...APPROVED, words);
	const line = ticket(PLAN).split("\n").find((each) => each.includes("(AC-D1"));
	assert.equal(line?.length, 400);
	assert.match(line ?? "", /^- 2026-03-04: Plan approved by the owner: plan\.md at abc1234; the owner: "Yes\. Keep the old menu .*…" \(AC-D1, cut: arthur decisions AC-D1 prints it whole\)$/);
	assert.equal(log()?.[1].words, words.trim());
	const whole = (await decisions("AC-D1"))[1];
	assert.ok(whole.includes(`the owner: "${words.trim()}"`), whole);
	await decision("ask", "--kind", "question", "--question", "Next?");
	assert.equal(ticket(PLAN).split("(AC-D1").length, 2, "a cut line counts as written");
});

test("arthur decisions: no log says so and creates none; words, --open, --kind and --ticket filter; --project reads another log; one id prints whole", async (t) => {
	const { decision, decisions, run, file, shop, fake } = await setup(t);
	assert.deepEqual(await decisions(), [0, "no decisions yet"]);
	assert.deepEqual(await decisions("--open", "menu"), [0, "no decisions yet"]);
	assert.equal(existsSync(file()), false);
	await decision(...PLAN_ASK);
	await decision("ask", "--kind", "question", "--question", "Which colour for the Menu?", "--ticket", "AC0002");
	fake.setNow(new Date("2026-03-06T12:00:00Z"));
	await decision("answer", "AC-D2", "--decided", "Blue", "niebieski");
	await run("decision", ["ask", "--kind", "budget", "--question", "Raise the budget of shop?"], "shop");
	const lines = {
		plan: "AC-D1 2026-03-04 plan AC0001: Approve the plan of AC0001? — open",
		colour: "AC-D2 2026-03-04 question AC0002: Which colour for the Menu? — answered 2026-03-06: Blue",
	};
	assert.deepEqual(await decisions(), [0, `${lines.plan}\n${lines.colour}`]);
	assert.deepEqual(await decisions("menu"), [0, lines.colour]);
	assert.deepEqual(await decisions("NIEBIESKI"), [0, lines.colour], "the owner's words, in any case");
	assert.deepEqual(await decisions("menu", "plan"), [0, "no decision matches"]);
	assert.deepEqual(await decisions("--open"), [0, lines.plan]);
	assert.deepEqual(await decisions("--kind", "question"), [0, lines.colour]);
	assert.deepEqual(await decisions("--ticket", "ac0001"), [0, lines.plan]);
	assert.deepEqual(await decisions("--kind", "vote"), [1, "arthur decisions: --kind vote: one of job, question, plan, review, budget, merge"]);
	const usage = "usage: arthur decisions [<words>] [--open] [--kind <kind>] [--ticket <id>], arthur decisions <id>, or arthur decisions --classes";
	for (const args of [["--kind"], ["--classes", "--open"], ["--classes", "budget"]]) assert.deepEqual(await decisions(...args), [2, usage], args.join(" "));
	assert.deepEqual(await decisions("--classes"), [0, "no classes yet"]);
	assert.deepEqual(await run("decisions", [], "shop"), [0, "SH-D1 2026-03-06 budget: Raise the budget of shop? — open"]);
	assert.ok(existsSync(join(shop, "spec/decisions.jsonl")));
	assert.deepEqual(await decisions("AC-D7"), [1, "arthur decisions: AC-D7 is not in the decision log of project acme"]);
	assert.deepEqual(await decisions("ac-d1"), [
		0,
		[
			"AC-D1: plan, asked 2026-03-04T06:00:00+01:00, ticket AC0001",
			"Question: Approve the plan of AC0001?",
			"Options: 1. Approve; 2. Plan again",
			"Recommended: 1 (Approve)",
			"Now: open",
		].join("\n"),
	]);
	assert.deepEqual(await decisions("AC-D2"), [
		0,
		[
			"AC-D2: question, asked 2026-03-04T06:00:00+01:00, ticket AC0002",
			"Question: Which colour for the Menu?",
			'Answered 2026-03-06T13:00:00+01:00: Blue; the owner: "niebieski"',
			"Now: answered",
		].join("\n"),
	]);
});

test("the context lists each open question with its age and up to 5 answered ones like it: same kind, then shared words, then the newest", async (t) => {
	const { decision, context, fake, run, projects } = await setup(t);
	assert.equal(await context(), undefined, "no log, no section");
	const answered = async (kind: string, question: string, decided: string, at: string) => {
		fake.setNow(new Date(at));
		const [, id] = await decision("ask", "--kind", kind, "--question", question);
		await decision("answer", id, "--decided", decided, "ok");
	};
	await answered("question", "Is the menu colour blue?", "Blue menu", "2026-03-01T10:00:00Z");
	await answered("plan", "Approve the plan of the menu colour?", "Approved", "2026-03-01T11:00:00Z");
	await answered("plan", "Approve the plan of the login?", "Approved login", "2026-03-01T12:00:00Z");
	await answered("plan", "Approve the plan of the search?", "Approved search", "2026-03-01T13:00:00Z");
	await answered("plan", "Ship it?", "Shipped", "2026-03-01T14:00:00Z");
	await answered("plan", "Approve the plan of the footer?", "Approved footer", "2026-03-01T15:00:00Z");
	await answered("budget", "Raise orchestration's budget?", "Raised", "2026-03-01T16:00:00Z");
	assert.equal(await context(), undefined, "no open question, no similar decisions");
	fake.setNow(new Date("2026-03-04T05:00:00Z"));
	await decision("ask", "--kind", "plan", "--question", "Approve the plan of the menu?", "--ticket", "AC0001");
	await run("decision", ["ask", "--kind", "question", "--question", "Close the shop?"], "shop");
	await decision("ask", "--kind", "review", "--question", "Third round?");
	fake.setNow(new Date("2026-03-04T07:05:00Z"));
	assert.equal(
		await context(),
		[
			"- AC-D8, plan, ticket AC0001, open for 2h05m: Approve the plan of the menu?",
			"  - like it, AC-D2 of 2026-03-01: Approve the plan of the menu colour? → Approved",
			"  - like it, AC-D6 of 2026-03-01: Approve the plan of the footer? → Approved footer",
			"  - like it, AC-D4 of 2026-03-01: Approve the plan of the search? → Approved search",
			"  - like it, AC-D3 of 2026-03-01: Approve the plan of the login? → Approved login",
			"  - like it, AC-D5 of 2026-03-01: Ship it? → Shipped",
			"- AC-D9, review, open for 2h05m: Third round?",
			"- SH-D1, question, open for 2h05m: Close the shop?",
		].join("\n"),
	);
	// A fresh conversation: a new load of the plugin reads the same open questions in its first context.
	const again = fakeHost({ name: "orchestration", timeZone: "Europe/Warsaw", now: new Date("2026-03-04T07:05:00Z") });
	again.provide("projects", () => projects);
	await again.setup(orchestration());
	const printed: string[] = [];
	t.mock.method(console, "log", (text: string) => void printed.push(text));
	await again.commands.find((command) => command.name === "coordinator")?.run({ args: ["context"], project: undefined });
	assert.match(printed.join("\n"), /\n## Open decisions\n\n- AC-D8, plan, ticket AC0001, open for 2h05m: Approve the plan of the menu\?\n/);
});

// A project demo (DM) in a folder of its own whose config sets up the plugin in UTC, for `arthur` run as a process there.
function demo(): string {
	const folder = temporaryFolder();
	mkdirSync(join(folder, "spec"));
	writeFileSync(join(folder, "spec/build.json"), "[]");
	const projects = `{ name: "projects", setup(host) { host.provide("projects", () => [{ name: "demo", path: ${JSON.stringify(folder)}, prefix: "DM" }]); } }`;
	writeFileSync(join(folder, "arthur.config.ts"), `import { orchestration } from ${JSON.stringify(PLUGIN)};\nexport default { core: { timeZone: "UTC" }, plugins: [orchestration(), ${projects}] };\n`);
	return folder;
}

test("asks at once, from four processes asking five times each, get one id each and every line is kept", async (t) => {
	const saved = process.env.ARTHUR_JOB;
	delete process.env.ARTHUR_JOB;
	t.after(() => (saved === undefined ? delete process.env.ARTHUR_JOB : (process.env.ARTHUR_JOB = saved)));
	const folder = demo();
	const asks = async (writer: number) => {
		const script = `for n in 1 2 3 4 5; do "$0" "$1" decision ask --kind question --question "${writer}.$n?" || exit 1; done`;
		const child = spawn("sh", ["-c", script, process.execPath, CLI], { cwd: folder, env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
		let out = "";
		child.stdout.on("data", (chunk) => (out += chunk));
		child.stderr.on("data", (chunk) => (out += chunk));
		const [code] = await once(child, "exit");
		return [code, out.trim()] as const;
	};
	const results = await Promise.all([1, 2, 3, 4].map(asks));
	assert.deepEqual(results.map(([code]) => code), [0, 0, 0, 0], JSON.stringify(results));
	const ids = results.flatMap(([, out]) => out.split("\n"));
	assert.deepEqual(ids.toSorted(), Array.from({ length: 20 }, (_, at) => `DM-D${at + 1}`).toSorted(), "twenty ids, none twice");
	const log = readFileSync(join(folder, "spec/decisions.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(log.map((each) => each.id), Array.from({ length: 20 }, (_, at) => `DM-D${at + 1}`), "every line kept, in the order asked");
	assert.equal(new Set(log.map((each) => each.question)).size, 20);
	assert.match(log[0].time, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$/, "UTC's offset written out");
});

// Whatever the timing: another process holds the log's lock, the ask waits on it (its own lock file beside it), and only then
// does the holder write a record and let go. An ask that wrote without the lock is before that record, or its id is the same.
test("an ask waits for the log's lock another process holds, and writes after that process's record", async () => {
	const folder = demo();
	const lock = join(folder, ".arthur/orchestration/decisions-demo.lock");
	const file = join(folder, "spec/decisions.jsonl");
	mkdirSync(dirname(lock), { recursive: true });
	const marker = { record: "ask", id: "DM-D1", time: "2026-03-04T05:00:00+00:00", project: "demo", kind: "question", question: "Held?", options: [] };
	const code = `const { takeLock } = await import(${JSON.stringify(import.meta.resolve("@arthur/core/lock"))});
		const { appendFileSync } = await import("node:fs");
		const lock = takeLock(${JSON.stringify(lock)});
		if (!("release" in lock)) process.exit(1);
		process.send("held");
		process.once("message", () => {
			appendFileSync(${JSON.stringify(file)}, ${JSON.stringify(`${JSON.stringify(marker)}\n`)});
			lock.release();
			process.disconnect();
		});`;
	const holder = spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
	const held = once(holder, "exit");
	await Promise.race([once(holder, "message"), held.then(([status]) => assert.fail(`the holder exited with ${status} before it held the lock`))]);
	const asker = spawn(process.execPath, [CLI, "decision", "ask", "--kind", "question", "--question", "After?"], { cwd: folder, env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
	let out = "";
	asker.stdout.on("data", (chunk) => (out += chunk));
	asker.stderr.on("data", (chunk) => (out += chunk));
	const asked = once(asker, "exit");
	while (!existsSync(`${lock}.${asker.pid}`) && !existsSync(file) && asker.exitCode === null) await sleep(2);
	holder.send("release");
	assert.deepEqual([(await held)[0], (await asked)[0], out.trim()], [0, 0, "DM-D2"]);
	const log = readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(log.map((each) => [each.id, each.question]), [["DM-D1", "Held?"], ["DM-D2", "After?"]], "the ask's record after the holder's");
});

// Decision classes (spec/roadmap.md, entry 97): three budget questions the owner answered alike, AC-D1 to AC-D3; the
// recommendation agreed with his pick on AC-D1, not on AC-D2, and AC-D3 had none to score.
async function backed(decision: (...args: string[]) => Promise<Ran>) {
	const said: Ran[] = [];
	said.push(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of orchestration by 40?", "--ticket", "AC0001", "--option", "Raise it", "--option", "Cut code", "--recommend", "1"));
	said.push(await decision("answer", "AC-D1", "--decided", "Raise the line budget", "--picked", "1", "tak"));
	said.push(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of core by 6?", "--ticket", "AC0002", "--option", "Raise it", "--option", "Cut code", "--recommend", "Cut code"));
	said.push(await decision("answer", "AC-D2", "--decided", "raise the line  budget", "--picked", "1", "yes"));
	said.push(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of develop by 9?"));
	said.push(await decision("answer", "AC-D3", "--decided", "Raise the line budget", "sure"));
	assert.deepEqual(said.map(([code]) => code), [0, 0, 0, 0, 0, 0]);
}
const PROPOSE = ["class", "propose", "--kind", "budget", "--match", "line budget", "--decided", "Raise the line budget", "--backed-by", "AC-D1", "AC-D2", "ac-d3"];
const APPROVE = ["--picked", "1", "--decided", "Pre-approve raising a line budget"];
const POLICY_SAID = (id: string, by: string) => `${id}\n${id} answered by policy (${by}): Raise the line budget; act on it as on the owner's answer, and say so in your reply`;

test("a class is proposed from the owner's same answers with their agreement rate, holds only once he approves it, and then answers its questions by policy in the log and the ticket", async (t) => {
	const { decision, decisions, log, ticket } = await setup(t);
	await backed(decision);
	assert.deepEqual(await decision(...PROPOSE), [
		0,
		[
			"AC-D4",
			'budget questions naming "line budget" → Raise the line budget; backed by AC-D1, AC-D2, AC-D3; the recommendation agreed with the owner\'s pick on 1 of 2 (1 with no recommendation or pick, not scored)',
			"Ask the owner with AC-D4; his answer: arthur decision answer AC-D4 --picked 1 (approve) or 2 (refuse) --decided '<one line>' '<his words>'",
		].join("\n"),
	]);
	assert.deepEqual(log()?.[6], {
		record: "ask",
		id: "AC-D4",
		time: "2026-03-04T06:00:00+01:00",
		project: "acme",
		kind: "class",
		question: 'Pre-approve a class: budget questions naming "line budget" → Raise the line budget, by policy, without asking you?',
		options: ["Approve the class", "Refuse it"],
		recommend: 1,
		class: { kind: "budget", match: "line budget", decided: "Raise the line budget", backedBy: ["AC-D1", "AC-D2", "AC-D3"], agreed: 1, scored: 2 },
	});
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of delivery?"), [0, "AC-D5"], "a class only proposed answers nothing");
	assert.deepEqual(await decision("answer", "AC-D4", ...APPROVE, "tak,", "zawsze"), [0, "AC-D4 answered: Pre-approve raising a line budget; the class is approved: its questions are answered by policy from now on"]);
	assert.deepEqual(log()?.at(-1)?.words, "tak, zawsze", "approved in the owner's words");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the LINE budget of youtrack by 3?", "--ticket", "AC0002"), [0, POLICY_SAID("AC-D6", "AC-D4")]);
	assert.deepEqual(log()?.slice(-2), [
		{ record: "ask", id: "AC-D6", time: "2026-03-04T06:00:00+01:00", project: "acme", kind: "budget", question: "Raise the LINE budget of youtrack by 3?", options: [], ticket: "AC0002" },
		{ record: "answer", id: "AC-D6", time: "2026-03-04T06:00:00+01:00", decided: "Raise the line budget", words: "by policy: AC-D4" },
	]);
	const line = "- 2026-03-04: Raise the line budget; pre-approved by policy (AC-D4)";
	assert.equal(ticket(BARE).split("\n").filter((each) => each === line).length, 1, "the ticket's line names the class");
	assert.ok(!ticket(BARE).split("\n").some((each) => each.includes("(AC-D6)")), "never the owner's words");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of nvm?", "--ticket", "AC0002"), [0, POLICY_SAID("AC-D7", "AC-D4")]);
	assert.deepEqual(await decision("ask", "--kind", "question", "--question", "Raise the line budget?"), [0, "AC-D8"], "another kind goes to the owner");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the budget of the lines?"), [0, "AC-D9"], "a question that does not name every word as a word goes to the owner");
	assert.equal(ticket(BARE).split("\n").filter((each) => each === line).length, 2, "two answers by policy, two lines, each written once");
	assert.deepEqual(await decisions("--classes"), [0, 'AC-D4 approved 2026-03-04: budget questions naming "line budget" → Raise the line budget; backed by AC-D1, AC-D2, AC-D3; the recommendation agreed with the owner\'s pick on 1 of 2 (1 with no recommendation or pick, not scored); answered by policy: AC-D6, AC-D7']);
	assert.deepEqual((await decisions())[1].split("\n")[5], "AC-D6 2026-03-04 budget AC0002: Raise the LINE budget of youtrack by 3? — answered 2026-03-04: Raise the line budget");
	assert.deepEqual((await decisions("AC-D6"))[1].split("\n").slice(2), ["Answered 2026-03-04T06:00:00+01:00: Raise the line budget; by policy (AC-D4)", "Now: answered"]);
	const whole = (await decisions("AC-D4"))[1].split("\n");
	assert.equal(whole[2], 'Class: budget questions naming "line budget" → Raise the line budget; backed by AC-D1, AC-D2, AC-D3; the recommendation agreed with the owner\'s pick on 1 of 2 (1 with no recommendation or pick, not scored)');
	assert.equal(whole.at(-1), "Now: the class is approved; answered by policy: AC-D6, AC-D7");
});

test("a proposal is refused, naming why and writing nothing: no backing decision, an unknown, unanswered or differing one, a class's own kind", async (t) => {
	const { decision, file, run } = await setup(t);
	await backed(decision);
	await decision("ask", "--kind", "budget", "--question", "Raise the line budget of manage?");
	await decision("ask", "--kind", "budget", "--question", "Raise the line budget of nvm?");
	await decision("close", "AC-D5", "asked twice");
	await decision("ask", "--kind", "question", "--question", "Raise the line budget or cut?");
	await decision("answer", "AC-D6", "--decided", "Raise the line budget", "raise");
	await decision("ask", "--kind", "budget", "--question", "Raise the budget of uptime?");
	await decision("answer", "AC-D7", "--decided", "Raise the line budget", "raise");
	await decision("ask", "--kind", "budget", "--question", "Raise the line budget of github?");
	await decision("answer", "AC-D8", "--decided", "Cut code instead", "cut");
	const before = readFileSync(file(), "utf8");
	const refused = (why: string): Ran => [1, `arthur decision class propose: refused: ${why}`];
	const propose = (...args: string[]) => decision("class", "propose", "--kind", "budget", "--match", "line budget", "--decided", "Raise the line budget", ...args);
	assert.deepEqual(await propose(), refused("backed by no decision: --backed-by <id>... names the owner's answered decisions, each his same answer"));
	assert.deepEqual(await propose("--backed-by", "AC-D1", "AC-D99"), refused("AC-D99 is not in the decision log of project acme"));
	assert.deepEqual(await propose("--backed-by", "AC-D1", "AC-D4"), refused("AC-D4 is open, not answered by the owner"));
	assert.deepEqual(await propose("--backed-by", "AC-D5"), refused("AC-D5 is closed, not answered by the owner"));
	assert.deepEqual(await propose("--backed-by", "AC-D1", "AC-D8"), refused('AC-D8 decided "Cut code instead", not the class\'s "Raise the line budget"'));
	assert.deepEqual(await propose("--backed-by", "AC-D6"), refused("AC-D6 is a question question, not budget"));
	assert.deepEqual(await propose("--backed-by", "AC-D7"), refused('AC-D7 does not name every word of --match "line budget": Raise the budget of uptime?'));
	assert.deepEqual(await decision("class", "propose", "--kind", "class", "--match", "line budget", "--decided", "Raise", "--backed-by", "AC-D1"), refused("--kind class: a class never approves a class; one of job, question, plan, review, budget, merge"));
	assert.deepEqual(await decision("class", "propose", "--kind", "vote", "--match", "line budget", "--decided", "Raise", "--backed-by", "AC-D1"), refused('kind "vote": one of job, question, plan, review, budget, merge'));
	assert.deepEqual(await decision("class", "propose", "--kind", "budget", "--match", " - ", "--decided", "Raise", "--backed-by", "AC-D1"), refused("--match names no word: the words every question of the class names"));
	assert.deepEqual(await decision("class", "propose", "--kind", "budget", "--match", "line", "--backed-by", "AC-D1"), refused("no --decided: the class's decision in one English line"));
	assert.deepEqual(await run("decision", ["class", "propose", "--kind", "budget", "--match", "line", "--decided", "Raise", "--backed-by", "AC-D1"], "nowhere"), refused("unknown project nowhere; projects: acme, shop"));
	assert.equal(readFileSync(file(), "utf8"), before);
	for (const args of [["class"], ["class", "vote"], ["class", "propose", "AC-D1"], ["class", "propose", "--color", "red"], ["class", "revoke"]]) {
		const [code, said] = await decision(...args);
		assert.deepEqual([code, said.split("\n").slice(3)], [2, ["       arthur decision class propose --kind <kind> --match <text> --decided <one line> --backed-by <id>...", "       arthur decision class revoke <id> <the owner's words>"]], args.join(" "));
	}
	assert.equal(readFileSync(file(), "utf8"), before);
});

test("a class is approved only on the owner's word: inside a job, by policy, or with no pick is refused; a question answered by policy never backs a class", async (t) => {
	const { decision, file, log } = await setup(t);
	await backed(decision);
	await decision(...PROPOSE);
	const before = readFileSync(file(), "utf8");
	const refused = (why: string): Ran => [1, `arthur decision answer: refused: ${why}`];
	assert.deepEqual(await decision("answer", "AC-D4", ...APPROVE, "by policy: AC-D4"), refused("an answer given by policy: only arthur decision ask answers by policy, and only a class the owner approved in his own words"));
	assert.deepEqual(await decision("answer", "AC-D4", "--decided", "Approve", "yes"), refused("AC-D4 proposes a class: --picked 1 approves it, --picked 2 refuses it"));
	process.env.ARTHUR_JOB = "/home/arthur/.arthur/jobs/2026-03-04-worker-0000abcd";
	const inside = [1, "arthur decision: refused inside a job 2026-03-04-worker-0000abcd: a job never records the owner's word; end your run with Blocked: user <question> instead"];
	assert.deepEqual(await decision(...PROPOSE), inside);
	assert.deepEqual(await decision("class", "revoke", "AC-D4", "stop"), inside);
	assert.deepEqual(await decision("answer", "AC-D4", ...APPROVE, "yes"), inside);
	delete process.env.ARTHUR_JOB;
	assert.equal(readFileSync(file(), "utf8"), before);
	await decision("answer", "AC-D4", ...APPROVE, "yes");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of nvm?"), [0, POLICY_SAID("AC-D5", "AC-D4")]);
	assert.deepEqual(await decision("class", "propose", "--kind", "budget", "--match", "nvm", "--decided", "Raise the line budget", "--backed-by", "AC-D5"), [1, "arthur decision class propose: refused: AC-D5 was answered by policy (AC-D4), not by the owner"]);
	assert.equal(log()?.length, 10);
});

test("a hand edit of a class's records refuses every write: an approval by policy, an answer by policy of no class, a revoke of no class, a class with no backing", async (t) => {
	const { decision, decisions, file } = await setup(t);
	await backed(decision);
	await decision(...PROPOSE);
	const time = "2026-03-04T06:00:00+01:00";
	const good = readFileSync(file(), "utf8");
	for (const [line, why] of [
		[{ record: "answer", id: "AC-D4", time, decided: "Approved", picked: 1, words: "by policy: AC-D4" }, "AC-D4, a class, approved by policy: only the owner approves a class"],
		[{ record: "answer", id: "AC-D3", time, decided: "Raise", words: "by policy: AC-D1" }, "an answer by policy of AC-D1, which is no class above it"],
		[{ record: "revoke", id: "AC-D1", time, words: "stop" }, "a revoke of AC-D1, which is no class"],
		[{ record: "revoke", id: "AC-D4", time, words: "" }, "no words"],
		[{ record: "ask", id: "AC-D5", time, project: "acme", kind: "class", question: "Class?", options: [], class: { kind: "budget", match: "x", decided: "y", backedBy: [], agreed: 0, scored: 0 } }, "a class backed by no decision"],
		[{ record: "ask", id: "AC-D5", time, project: "acme", kind: "class", question: "Class?", options: [], class: { kind: "class", match: "x", decided: "y", backedBy: ["AC-D1"], agreed: 0, scored: 0 } }, 'class kind "class"'],
		[{ record: "ask", id: "AC-D5", time, project: "acme", kind: "budget", question: "Q?", options: [], class: { kind: "budget" } }, "a class on a question of no class"],
	] as const) {
		writeFileSync(file(), `${good}${JSON.stringify(line)}\n`);
		const named = `${file()} line 8 is not a decision record (${why}); only arthur decision writes the log: undo the hand edit (git diff -- spec/decisions.jsonl); nothing was written`;
		assert.deepEqual(await decision("class", "revoke", "AC-D4", "stop"), [1, `arthur decision class revoke: refused: ${named}`], why);
		assert.deepEqual(await decisions("--classes"), [1, `arthur decisions: ${named}`]);
	}
});

test("a refused class answers nothing; the later answer to a proposal counts; a revoke sends its questions to the owner again and keeps those answered by policy", async (t) => {
	const { decision, decisions, fake, log } = await setup(t);
	await backed(decision);
	await decision(...PROPOSE);
	assert.deepEqual(await decision("answer", "AC-D4", "--picked", "2", "--decided", "Keep asking about budgets", "nie"), [0, "AC-D4 answered: Keep asking about budgets; the class is refused: its questions go to the owner"]);
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of nvm?"), [0, "AC-D5"], "a refused class: the question goes to the owner");
	assert.deepEqual(await decision("answer", "AC-D4", ...APPROVE, "ok, jednak tak"), [0, "AC-D4 answered: Pre-approve raising a line budget; the class is approved: its questions are answered by policy from now on"]);
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of uptime?"), [0, POLICY_SAID("AC-D6", "AC-D4")], "the later answer counts");
	const refused = (why: string): Ran => [1, `arthur decision class revoke: refused: ${why}`];
	assert.deepEqual(await decision("class", "revoke", "AC-D4"), refused("no words: arthur decision class revoke AC-D4 <the owner's words>"));
	assert.deepEqual(await decision("class", "revoke", "AC-D1", "stop"), refused("AC-D1 is no class; arthur decisions --classes lists them"));
	assert.deepEqual(await decision("class", "revoke", "AC-D99", "stop"), refused("AC-D99 is not in the decision log of project acme"));
	fake.setNow(new Date("2026-03-06T09:00:00Z"));
	assert.deepEqual(await decision("class", "revoke", "ac-d4", "pytaj", "znowu"), [0, "AC-D4 revoked: its questions go to the owner again"]);
	assert.deepEqual(log()?.at(-1), { record: "revoke", id: "AC-D4", time: "2026-03-06T10:00:00+01:00", words: "pytaj znowu" });
	assert.deepEqual(await decision("class", "revoke", "AC-D4", "again"), refused("AC-D4 is revoked already, on 2026-03-06"));
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of manage?"), [0, "AC-D7"], "a question after the revoke goes to the owner");
	assert.deepEqual((await decisions("--classes"))[1], 'AC-D4 revoked 2026-03-06: budget questions naming "line budget" → Raise the line budget; backed by AC-D1, AC-D2, AC-D3; the recommendation agreed with the owner\'s pick on 1 of 2 (1 with no recommendation or pick, not scored); answered by policy: AC-D6');
	assert.match((await decisions("AC-D6"))[1], /\nAnswered .*; by policy \(AC-D4\)\nNow: answered$/, "an answer by policy before the revoke stays as recorded");
	const whole = (await decisions("AC-D4"))[1].split("\n");
	assert.deepEqual(whole.slice(-2), ['Revoked 2026-03-06T10:00:00+01:00: the owner: "pytaj znowu"', "Now: the class is revoked; answered by policy: AC-D6"]);
	await decision("answer", "AC-D4", ...APPROVE, "jednak tak");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of nvm again?"), [0, POLICY_SAID("AC-D8", "AC-D4")], "approved again after the revoke, it holds again");
});

test("a question two approved classes match goes to the owner naming both; a class of tickets of one kind answers only questions of that kind", async (t) => {
	const { decision, decisions, acme, log } = await setup(t);
	for (const path of [PLAN, BARE]) writeFileSync(join(acme, path), readFileSync(join(acme, path), "utf8").replace("## Goal\n\n", "## Goal\n\n- Kind: feature\n\n"));
	await backed(decision);
	assert.equal((await decision(...PROPOSE))[0], 0);
	assert.equal((await decision("class", "propose", "--kind", "budget", "--match", "orchestration", "--decided", "Raise the line budget", "--backed-by", "AC-D1"))[0], 0);
	await decision("answer", "AC-D4", ...APPROVE, "yes");
	await decision("answer", "AC-D5", ...APPROVE, "yes");
	assert.deepEqual(log()?.find((each) => each.id === "AC-D5")?.class?.ticketKind, "feature", "every backing ticket is a feature");
	assert.equal(log()?.find((each) => each.id === "AC-D4")?.class?.ticketKind, undefined, "AC-D3 has no ticket");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of orchestration again?", "--ticket", "AC0001"), [0, "AC-D6\nAC-D6 goes to the owner: it matches classes AC-D4 and AC-D5"]);
	assert.equal(log()?.at(-1)?.record, "ask", "no answer recorded");
	assert.deepEqual(await decisions("--classes"), [0, [
		'AC-D4 approved 2026-03-04: budget questions naming "line budget" → Raise the line budget; backed by AC-D1, AC-D2, AC-D3; the recommendation agreed with the owner\'s pick on 1 of 2 (1 with no recommendation or pick, not scored); answered by policy: none',
		'AC-D5 approved 2026-03-04: budget questions naming "orchestration" (feature tickets) → Raise the line budget; backed by AC-D1; the recommendation agreed with the owner\'s pick on 1 of 1; answered by policy: none',
	].join("\n")]);
	await decision("class", "revoke", "AC-D4", "no");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Orchestration needs more?"), [0, "AC-D7"], "a question of no ticket is not of a feature ticket");
	writeFileSync(join(acme, BARE), readFileSync(join(acme, BARE), "utf8").replace("- Kind: feature", "- Kind: bug"));
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Orchestration needs more?", "--ticket", "AC0002"), [0, "AC-D8"], "a bug ticket");
	assert.deepEqual(await decision("ask", "--kind", "budget", "--question", "Orchestration needs more?", "--ticket", "AC0001"), [0, "AC-D9\nAC-D9 answered by policy (AC-D5): Raise the line budget; act on it as on the owner's answer, and say so in your reply"]);
});

test("a job's question an approved class matches is answered by policy, and the wake says so with the decision to continue it with", async (t) => {
	const { decision, fake, log, blocked, notices } = await setup(t);
	blocked(JOB, "May I drop the old orders table?");
	await decision("answer", "AC-D1", "--decided", "Drop the table", "yes, drop it");
	assert.equal((await decision("class", "propose", "--kind", "job", "--match", "drop table", "--decided", "Drop the table", "--backed-by", "AC-D1"))[0], 0);
	await decision("answer", "AC-D2", "--picked", "1", "--decided", "Pre-approve dropping tables", "always");
	const other = "2026-03-04-worker-0000ffff";
	blocked(other, "May I drop the archive table?");
	assert.deepEqual(log()?.slice(-1), [{ record: "answer", id: "AC-D3", time: "2026-03-04T06:00:00+01:00", decided: "Drop the table", words: "by policy: AC-D2" }]);
	assert.equal(notices().at(-1), `${other} asks [AC-D3]: May I drop the archive table? — answered by policy (AC-D2): Drop the table`);
	const wake = { id: other, kind: "worker", project: "acme", state: "blocked", reason: "user: May I drop the archive table?" };
	assert.deepEqual(fake.collect("coordinator.wake", wake).filter(Boolean), [
		`Its question is decision AC-D3, answered by policy (AC-D2): Drop the table. Act on it as on the owner's answer, arthur continue ${other} '<that decision>', and say so in your reply.`,
	]);
	assert.deepEqual(fake.collect("coordinator.wake", { ...wake, id: JOB, reason: "user: May I drop the old orders table?" }).filter(Boolean), [], "a question the owner answered needs no line");
});

test("a job's question answered by policy and longer than one message is cut before what decided it; an ending that leaves no room is cut as any text", async (t) => {
	const { decision, blocked, notices } = await setup(t);
	blocked(JOB, "May I drop the old orders table?");
	await decision("answer", "AC-D1", "--decided", "Drop the table", "yes, drop it");
	await decision("class", "propose", "--kind", "job", "--match", "drop table", "--decided", "Drop the table", "--backed-by", "AC-D1");
	await decision("answer", "AC-D2", "--picked", "1", "--decided", "Pre-approve dropping tables", "always");
	const other = "2026-03-04-worker-0000ffff";
	// AC-D3 and AC-D4: heads of one length.
	const head = `${other} asks [AC-D3]: `;
	const ending = " — answered by policy (AC-D2): Drop the table";
	const tail = " … (cut; /jobs shows the whole question of job 0000ffff)";
	const asked = "May I drop the archive table? ";
	const whole = `${asked}${"q".repeat(4096 - head.length - asked.length - ending.length)}`;
	blocked(other, whole);
	assert.equal(notices().at(-1), `${head}${whole}${ending}`, "4096 exactly is sent whole");
	blocked(other, `${whole}!`);
	const cut = `${other} asks [AC-D4]: ${whole.slice(0, 4096 - head.length - tail.length - ending.length)}${tail}${ending}`;
	assert.equal(cut.length, 4096);
	assert.equal(notices().at(-1), cut);

	// An ending that leaves the head exactly its room is kept, all of the question cut; one character more, the text is cut.
	const room = async (subject: string, [backing, proposal, asked]: readonly string[], over: number) => {
		const [head, opening] = [`${other} asks [${asked}]: `, ` — answered by policy (${proposal}): `];
		const decided = subject.padEnd(4096 - tail.length - head.length - opening.length + over, "s");
		blocked("2026-03-04-worker-0000eeee", `May I ${subject}?`);
		await decision("answer", String(backing), "--decided", decided, "yes");
		await decision("class", "propose", "--kind", "job", "--match", subject, "--decided", decided, "--backed-by", String(backing));
		await decision("answer", String(proposal), "--picked", "1", "--decided", "Pre-approve it", "always");
		const question = `May I ${subject} again? ${"q".repeat(100)}`;
		blocked(other, question);
		return { head, ending: `${opening}${decided}`, text: `${head}${question}${opening}${decided}` };
	};
	const fits = await room("purge logs", ["AC-D5", "AC-D6", "AC-D7"], 0);
	assert.equal(notices().at(-1), `${fits.head}${tail}${fits.ending}`);
	const over = await room("prune caches", ["AC-D8", "AC-D9", "AC-D10"], 1);
	assert.equal(notices().at(-1), `${over.text.slice(0, 4096 - tail.length)}${tail}`);
});

test("the agreement rate scores a recommendation by number or by an option's words against the owner's pick", async (t) => {
	const { decision } = await setup(t);
	await decision("ask", "--kind", "review", "--question", "Third round for AC0001?", "--option", "Another round", "--option", "Drop it", "--recommend", "2");
	await decision("answer", "AC-D1", "--decided", "Another round", "--picked", "1", "again");
	await decision("ask", "--kind", "review", "--question", "Third round for AC0002?", "--option", "Another round", "--option", "Drop it", "--recommend", "another  ROUND");
	await decision("answer", "AC-D2", "--decided", "Another round", "--picked", "1", "again");
	const [code, said] = await decision("class", "propose", "--kind", "review", "--match", "third round", "--decided", "Another round", "--backed-by", "AC-D1", "AC-D2");
	assert.deepEqual([code, said.split("\n")[1]], [0, 'review questions naming "third round" → Another round; backed by AC-D1, AC-D2; the recommendation agreed with the owner\'s pick on 1 of 2']);
});

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
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
// up on the fake host in Warsaw, outside any job.
async function setup(t: TestContext) {
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
	const fake = fakeHost({ name: "orchestration", timeZone: "Europe/Warsaw", now: NOW });
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
	assert.deepEqual(await decision("ask", "--kind", "vote", "--question", "Go?"), refused('kind "vote": one of job, question, plan, review, budget'));
	assert.deepEqual(await decision("ask", "--question", "Go?"), refused('kind "": one of job, question, plan, review, budget'));
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Go?", "--ticket", "AC0099"), refused("--ticket AC0099 is not on the board of project acme"));
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Go?", "--ticket", "SH0001"), refused("--ticket SH0001 is not on the board of project acme"));
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Go?", "--option", "a", "--option", "b", "--recommend", "3"), refused("--recommend 3: no such option; 2 offered (--option)"));
	assert.deepEqual(await decision("ask", "--kind", "plan", "--question", "Go?", "--recommend", "1"), refused("--recommend 1: no such option; 0 offered (--option)"));
	assert.deepEqual(await run("decision", ["ask", "--kind", "plan", "--question", "Go?"], "nowhere"), refused("unknown project nowhere; projects: acme, shop"));
	assert.equal(existsSync(file()), false);
	for (const args of [["ask", "--kind", "plan", "--question", "Go?", "extra"], ["ask", "--kind"], ["ask", "--kind", "plan", "--kind", "job", "--question", "Go?"], ["ask", "--color", "red"], ["vote"], [], ["answer"], ["close"]]) {
		const [code, said] = await decision(...args);
		assert.deepEqual([code, said.split("\n")[0]], [2, "usage: arthur decision ask --kind <kind> --question <text> [--ticket <id>] [--job <id>] [--option <text>]... [--recommend <n or text>]"], args.join(" "));
	}
	assert.equal(existsSync(file()), false);
});

test("inside a job every arthur decision is refused and writes nothing; arthur decisions still reads", async (t) => {
	const { decision, decisions, file } = await setup(t);
	assert.deepEqual(await decision(...PLAN_ASK), [0, "AC-D1"]);
	const before = readFileSync(file(), "utf8");
	process.env.ARTHUR_JOB = "/home/arthur/.arthur/jobs/2026-03-04-worker-0000abcd";
	const refusal = "arthur decision: refused inside a job (ARTHUR_JOB is set): a job never records the owner's word; end your run with Blocked: user <question> instead";
	for (const args of [PLAN_ASK, ["answer", "AC-D1", ...APPROVED, "ok"], ["close", "AC-D1", "gone"], ["vote"]]) assert.deepEqual(await decision(...args), [1, refusal], args[0]);
	assert.equal(readFileSync(file(), "utf8"), before);
	assert.deepEqual(await decisions(), [0, "AC-D1 2026-03-04 plan AC0001: Approve the plan of AC0001? — open"]);
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
	assert.deepEqual(await decisions("--kind", "vote"), [1, "arthur decisions: --kind vote: one of job, question, plan, review, budget"]);
	assert.deepEqual(await decisions("--kind"), [2, "usage: arthur decisions [<words>] [--open] [--kind <kind>] [--ticket <id>], or arthur decisions <id>"]);
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

test("asks at once, from four processes asking five times each, get one id each and every line is kept", async (t) => {
	const saved = process.env.ARTHUR_JOB;
	delete process.env.ARTHUR_JOB;
	t.after(() => (saved === undefined ? delete process.env.ARTHUR_JOB : (process.env.ARTHUR_JOB = saved)));
	const folder = temporaryFolder();
	mkdirSync(join(folder, "spec"));
	writeFileSync(join(folder, "spec/build.json"), "[]");
	const projects = `{ name: "projects", setup(host) { host.provide("projects", () => [{ name: "demo", path: ${JSON.stringify(folder)}, prefix: "DM" }]); } }`;
	writeFileSync(join(folder, "arthur.config.ts"), `import { orchestration } from ${JSON.stringify(PLUGIN)};\nexport default { core: { timeZone: "UTC" }, plugins: [orchestration(), ${projects}] };\n`);
	const asks = async (writer: number) => {
		const script = `for n in 1 2 3 4 5; do "$0" "$1" decision ask --kind question --question "${writer}.$n?" || exit 1; done`;
		const child = spawn("sh", ["-c", script, process.execPath, CLI], { cwd: folder, env: { PATH: process.env.PATH ?? "" } });
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

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { fileURLToPath } from "node:url";
import { JOB_SCOPE } from "@arthur/core/inside-job";
import { type AgentRun, type FakeHost, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { orchestration } from "../src/orchestration.ts";
import { ownerSaid } from "./owner-said.ts";

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
	// Each answer `decision` records comes with the owner's own message holding its words and id, event 1, 2, ... in turn (AR0664).
	let said = 0;
	return {
		fake,
		printed,
		acme,
		shop,
		projects,
		file,
		decision: (...args: string[]) => {
			if (args[0] === "answer") ownerSaid(fake.host.folder, ++said, args.join(" "));
			return run("decision", args);
		},
		decisions: (...args: string[]) => run("decisions", args),
		run,
		log: (root = acme) => (existsSync(file(root)) ? readFileSync(file(root), "utf8").trim().split("\n").map((line) => JSON.parse(line)) : undefined),
		ticket: (path: string) => readFileSync(join(acme, path), "utf8"),
		async context() {
			printed.length = 0;
			await fake.commands.find((command) => command.name === "coordinator")?.run({ args: ["context"], project: undefined });
			const section = printed.join("\n").split("\n\n### Open decisions\n\n")[1]?.split("\n\n## Time\n\n")[0];
			assert.ok(section?.split("\n").every((line) => line.startsWith("> ")) ?? true, section);
			return section?.replace(/^> /gm, "");
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
const scope = JOB_SCOPE.exec(existsSync("/proc/self/cgroup") ? readFileSync("/proc/self/cgroup", "utf8").trimEnd() : "")?.[1];

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
	assert.deepEqual(log()?.[1], { record: "answer", id: "AC-D1", time: "2026-03-04T06:00:00+01:00", decided: "Plan approved by the owner: plan.md at abc1234", picked: 1, words: "ok, go", message: 1 });
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

// AR0664: the coordinator records the answer itself, so only one of the owner's own channel messages proves his words.
const UNPROVED: Ran = [1, "arthur decision answer: refused: no message of the owner holds these words: his own [via <channel>] message of this turn, or one sent after the question was asked, never a forward or the terminal; quote his words exactly as he wrote them"];

test("an answer is recorded only when an owner's channel message holds its words, case and spacing aside: of this turn, or answered after the ask", async (t) => {
	const { run, fake, file, log } = await setup(t);
	const { folder } = fake.host;
	await run("decision", PLAN_ASK);
	const before = readFileSync(file(), "utf8");
	const answer = (...words: string[]) => run("decision", ["answer", "AC-D1", ...APPROVED, ...words]);
	assert.deepEqual(await answer("ok, go"), UNPROVED, "no message at all");
	ownerSaid(folder, 1, "ok, go", { channel: null });
	ownerSaid(folder, 2, "ok, go", { channel: "" });
	ownerSaid(folder, 3, "[forwarded from Ola] ok, go");
	ownerSaid(folder, 4, "Mine: [forwarded from a hidden sender] ok, go");
	ownerSaid(folder, 5, "ok, go", { box: "answered", ms: NOW.getTime() - 1 });
	ownerSaid(folder, 6, "ok, go", { box: "answered", ms: NOW.getTime() + 999 });
	ownerSaid(folder, 7, "ok, go", { box: "queued" });
	writeFileSync(join(folder, "inbox/turn/8-1"), "{ not json");
	writeFileSync(join(folder, "inbox/turn/9-1"), "null");
	writeFileSync(join(folder, "inbox/turn/10"), JSON.stringify({ channel: "telegram", text: "ok, go" }));
	// "ok" and "go" inside a word: past its start only (took, ago), then past its end only (okra, gopher).
	ownerSaid(folder, 11, "We took it long ago");
	ownerSaid(folder, 15, "Okra, gopher");
	for (const words of [["ok, go"], ["ok"], ["go"], ["okay,", "go"]]) assert.deepEqual(await answer(...words), UNPROVED, words.join(" "));
	assert.equal(readFileSync(file(), "utf8"), before, "nothing written");
	ownerSaid(folder, 12, "ok, go", { box: "answered", ms: NOW.getTime() + 1000 });
	assert.equal((await answer("OK,", "go"))[0], 0, "answered the second after the ask; the case aside");
	assert.equal(log()?.at(-1)?.message, 12);
	ownerSaid(folder, 13, "Yes —\nok,go; and tell nobody", { ms: NOW.getTime() - 60_000 });
	assert.equal((await answer("ok, go"))[0], 0, "of this turn, whenever sent; the spacing aside");
	assert.deepEqual(log()?.filter((each) => each.record === "answer").map((each) => [each.words, each.message]), [["OK, go", 12], ["ok, go", 13]], "the latest message that holds them");
	assert.match((await run("decisions", ["AC-D1"]))[1], /\nAnswered [^\n]+; the owner: "ok, go" \(message 13\)\n/);
	// His words are text, never a pattern: each character a regular expression reads matches only itself.
	const odd = "a.b c*d e+f g?h (i) [j] {k} l|m n^o p$q r\\";
	ownerSaid(folder, 14, `So: ${odd}!`);
	assert.equal((await answer(odd))[0], 0, odd);
	assert.equal(log()?.at(-1)?.message, 14);
	for (const words of ["c.d", "zz|go"]) assert.deepEqual(await answer(words), UNPROVED, words);
});

test("a merge flag, --budget 0 and take-main need the owner's message naming the id, and send him a notice of what was recorded", async (t) => {
	const { run, fake, log, notices } = await setup(t);
	const { folder } = fake.host;
	const ask = async (...args: string[]) => (await run("decision", ["ask", "--question", "Go?", ...args]))[1];
	const flags = await ask("--kind", "merge", "--ticket", "AC0001", "--what", "--unreviewed", "--what", "--no-ci");
	const budget = await ask("--kind", "budget", "--ticket", "AC0002");
	const take = await ask("--kind", "merge");
	const plain = await ask("--kind", "merge", "--ticket", "AC0001");
	const job = await ask("--kind", "merge", "--job", JOB);
	const question = await ask("--kind", "question");
	ownerSaid(folder, 1, "Yes, go ahead. AC-D12 and AC-D20 too");
	const answer = (id: string) => run("decision", ["answer", id, "--decided", "Go", "yes, go ahead"]);
	for (const [id, what] of [[flags, "lets through --unreviewed and --no-ci"], [budget, "lets through --budget 0"], [take, "lets through arthur take-main"]] as const) {
		assert.deepEqual(await answer(id), [1, `arthur decision answer: refused: ${id} ${what}: the owner's message must name ${id} too, as in "${id} yes"; ask him to answer with its id`]);
	}
	for (const id of [plain, job, question]) assert.equal((await answer(id))[0], 0, `${id} lets nothing through`);
	assert.deepEqual(notices(), [], "an ordinary answer sends no notice");
	ownerSaid(folder, 2, "ac-d1 yes, go ahead");
	ownerSaid(folder, 3, "AC-D2: yes, go ahead");
	ownerSaid(folder, 4, "yes, go ahead (AC - D3)");
	for (const id of [flags, budget, take]) assert.equal((await answer(id))[0], 0, id);
	assert.deepEqual(log()?.filter((each) => each.record === "answer").map((each) => [each.id, each.message]), [[plain, 1], [job, 1], [question, 1], [flags, 2], [budget, 3], [take, 4]]);
	assert.deepEqual(notices(), [
		`Recorded as your decision ${flags} (merge of AC0001, lets through --unreviewed and --no-ci): Go; your words: "yes, go ahead"; your message: "ac-d1 yes, go ahead"`,
		`Recorded as your decision ${budget} (budget of AC0002, lets through --budget 0): Go; your words: "yes, go ahead"; your message: "AC-D2: yes, go ahead"`,
		`Recorded as your decision ${take} (merge, lets through arthur take-main): Go; your words: "yes, go ahead"; your message: "yes, go ahead (AC - D3)"`,
	]);
	assert.deepEqual(fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { decision: string }).decision), [flags, budget, take]);
});

// AR0668: a fragment of his "no" (its id, a dash, the word) once proved a "yes"; the notice now shows the message it came from.
test("a high-impact answer needs his answer quoted, not its id, a sign or one word; the notice quotes his whole message, cut at 400", async (t) => {
	const secret = "correct-horse-battery";
	const { run, fake, log, notices } = await setup(t, { ARTHUR_ORCHESTRATION_PASS: secret });
	const { folder } = fake.host;
	const ask = async (...args: string[]) => (await run("decision", ["ask", "--question", "Go?", ...args]))[1];
	const [flags, budget, take, plain] = [await ask("--kind", "merge", "--ticket", "AC0001", "--what", "--unreviewed"), await ask("--kind", "budget"), await ask("--kind", "merge"), await ask("--kind", "question")];
	const answer = (id: string, words: string) => run("decision", ["answer", id, "--decided", "Merge it", words]);
	const no = `${flags} no, do not merge — what is this?`;
	ownerSaid(folder, 1, `${no}\n[file, image/png] (/srv/media/AgAD-screen.png)`);
	const fragment = (words: string) => [1, `arthur decision answer: refused: ${flags} lets through --unreviewed: ${JSON.stringify(words)} is a fragment of the owner's message: quote his answer as he wrote it, as in "${flags} yes", not only its id, a sign or one word`];
	// Spaces the match ignores split no word: the rule reads his own text the words matched, `n o` being his `no`.
	const split = [`${flags[0]} ${flags.slice(1)}`, "n o", "d o", "N O,"];
	for (const words of [flags, "—", "no", "No,", ` ${flags.toLowerCase()} — `, "do", "n", ...split]) assert.deepEqual(await answer(flags, words), fragment(words.trim()), words);
	assert.equal(log()?.filter((each) => each.record === "answer").length, 0, "nothing written");
	assert.deepEqual(notices(), []);
	ownerSaid(folder, 2, `${budget} ok\n${take}: yes\n${plain} no`);
	for (const [id, words] of [[budget, budget], [take, "yes"], [take, `${take} —`], [take, `${budget} yes`], [take, `${budget} ${plain}`], [take, `${budget.toLowerCase()} - ${plain}: yes`]] as const) assert.match((await answer(id, words))[1], / is a fragment of the owner's message: /, words);
	assert.equal((await answer(plain, "no"))[0], 0, "a question that lets nothing through takes one word");
	assert.equal((await answer(budget, `${budget} ok`))[0], 0, "its id and one word");
	assert.equal((await answer(take, `${take}: yes`))[0], 0, "its id and one word, as he wrote them");
	assert.equal((await answer(flags, `${flags} no, do not merge`))[0], 0, "his answer quoted");
	assert.equal(notices().at(-1), `Recorded as your decision ${flags} (merge of AC0001, lets through --unreviewed): Merge it; your words: "${flags} no, do not merge"; your message: "${no}\n[file, image/png] (/srv/media/AgAD-screen.png)"`);
	// 399 code points, then a character of two UTF-16 units as the 400th: kept whole, the rest cut and the cut marked.
	const long = `${budget} yes ${"q".repeat(399 - budget.length - 5)}😀${"r".repeat(50)}`;
	ownerSaid(folder, 3, `${long}\n`);
	assert.equal((await answer(budget, `${budget} yes`))[0], 0);
	assert.equal(notices().at(-1), `Recorded as your decision ${budget} (budget, lets through --budget 0): Merge it; your words: "${budget} yes"; your message: "${long.slice(0, -50)} … (cut)"`);
	ownerSaid(folder, 4, long.slice(0, -50));
	assert.equal((await answer(budget, `${budget} yes`))[0], 0);
	assert.equal(notices().at(-1), `Recorded as your decision ${budget} (budget, lets through --budget 0): Merge it; your words: "${budget} yes"; your message: "${long.slice(0, -50)}"`, "400 code points are not cut");
	ownerSaid(folder, 5, long.slice(0, -49));
	assert.equal((await answer(budget, `${budget} yes`))[0], 0);
	assert.equal(notices().at(-1), `Recorded as your decision ${budget} (budget, lets through --budget 0): Merge it; your words: "${budget} yes"; your message: "${long.slice(0, -50)} … (cut)"`, "401 code points are cut, the cut marked");
	// A key and an env file's value he pastes reach neither the channel nor the event: his message is redacted as the log is.
	const key = "sk-live-4f9a8b7c6d5e4f3a2b1c";
	ownerSaid(folder, 6, `${budget} yes, the key is ${key}, the pass ${secret}`);
	assert.equal((await answer(budget, `${budget} yes`))[0], 0);
	assert.equal(notices().at(-1), `Recorded as your decision ${budget} (budget, lets through --budget 0): Merge it; your words: "${budget} yes"; your message: "${budget} yes, the key is [redacted], the pass [redacted]"`);
	assert.ok(!JSON.stringify(fake.emitted).includes(secret) && !JSON.stringify(fake.emitted).includes(key), "no event holds them");
	// An id of two digits split inside its number (`AC-D1 2`): the id of AC-D1 and a word "2" to the words, his AC-D12 alone in his message.
	for (let at = 5; at < 12; at++) await ask("--kind", "question");
	const twelve = await ask("--kind", "budget");
	ownerSaid(folder, 7, `${twelve} no, do not merge`);
	for (const words of [`${twelve.slice(0, -1)} ${twelve.slice(-1)}`, `${twelve.slice(0, 1)} ${twelve.slice(1)}`]) assert.match((await answer(twelve, words))[1], new RegExp(`^arthur decision answer: refused: ${twelve} lets through --budget 0: "${words}" is a fragment`), words);
	assert.equal((await answer(twelve, `${twelve} no`))[0], 0, "his id and his word");
});

test("a file's line of a message never proves his words or the id; a voice note's transcript does, its path aside", async (t) => {
	const { run, fake } = await setup(t);
	const { folder } = fake.host;
	const id = (await run("decision", ["ask", "--kind", "budget", "--question", "Go?"]))[1];
	const answer = (words: string) => run("decision", ["answer", id, "--decided", "Go", words]);
	const unproved = async (words: string) => assert.deepEqual(await answer(words), [1, `arthur decision answer: refused: ${id} lets through --budget 0: ${UNPROVED[1].slice("arthur decision answer: refused: ".length)}`], words);
	ownerSaid(folder, 1, `${id} see the file\n[file, application/pdf] (/srv/media/BQAD-${id} yes, go ahead.pdf)`);
	ownerSaid(folder, 2, `${id} hi\n[audio, audio/mpeg, 180 s] (/srv/media/CQAD-${id} yes go.mp3); listen failed: timed out`);
	ownerSaid(folder, 3, `${id} hi\n[audio 180 s] la la la (/srv/media/CQAD-${id} yes go on.mp3)`);
	ownerSaid(folder, 4, `${id} hi\n[photo ${id} yes, go now.png not saved: Discord gave no url]`);
	for (const words of [`${id} yes, go ahead`, `${id} yes go`, "go on.mp3", `${id} yes go on`, `${id} yes, go now`, "application/pdf"]) await unproved(words);
	// Each kind a channel saves, as the core's saved line and as a channel's not-saved line, both naming the sender's file.
	for (const [at, kind] of ["photo", "video", "voice", "audio", "file"].entries()) {
		ownerSaid(folder, 20 + at, `${id} hi\n[${kind}, ${kind}/x] (/srv/media/BAAD-${id} ${kind} saved, merge it.bin)\n[${kind} ${id} ${kind} lost, merge it.bin not saved: Discord gave no url]`);
		for (const words of [`${id} ${kind} saved, merge it`, `${id} ${kind} lost, merge it`]) await unproved(words);
	}
	ownerSaid(folder, 5, `yes, go\n[file, text/plain] (/srv/media/BQAD-${id}.txt)`);
	assert.match((await answer("yes, go"))[1], new RegExp(`the owner's message must name ${id} too`), "an id only in a file's name");
	ownerSaid(folder, 6, `[voice 4 s] ${id} yes, go ahead now (/srv/media/AwAD-${id} no.ogg)`);
	assert.equal((await answer(`${id} yes, go ahead now`))[0], 0, "the transcript");
	await unproved(`${id} no`);
	// Discord's line for a file it did not save, `[<kind> <file name> not saved: <why>]`, the file named `3 s] <id> yes, merge it.ogg`:
	// it reads like a transcript but ends in `]`, never in a transcript's path.
	ownerSaid(folder, 7, `${id} hi\n[audio 3 s] ${id} yes, merge it.ogg not saved: Discord gave no url]\n[voice 3 s] ${id} yes, merge now.ogg not saved: fetch failed (ECONNREFUSED)]`);
	for (const words of [`${id} yes, merge it`, `${id} yes, merge now`]) await unproved(words);
	// Discord gives a voice note's length unrounded, and listen writes it so; an audio file's transcript counts as a voice note's.
	ownerSaid(folder, 8, `[voice 3.52 s] ${id} yes, ship it (/srv/media/AwAD-voice.ogg)`);
	assert.equal((await answer(`${id} yes, ship it`))[0], 0, "a length with a decimal");
	ownerSaid(folder, 9, `[audio 61 s] ${id} yes, deploy it (/srv/media/CQAD-memo.mp3)`);
	assert.equal((await answer(`${id} yes, deploy it`))[0], 0, "an audio file's transcript");
	// Only a part's own kind starts a file's line: his text that starts with a bracket and a longer word is his.
	ownerSaid(folder, 10, `[filed under ops] ${id} yes, roll it`);
	assert.equal((await answer(`${id} yes, roll it`))[0], 0, "a word that starts like a kind");
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
	// Each wait below ends within 5 s, before `withLock` would give up on the live holder.
	const soon = { deadlineMs: 5000 };
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
		`Its question was not in the decision log yet: arthur decisions --kind job --project acme shows its id. Open, record the owner's answer first, arthur decision answer <its id> --decided '<the decision in one line>' '<his words>', then arthur continue ${JOB} '<his answer>'; answered by policy, the plugin continues the job with that decision by itself: say so in your reply.`,
	], "the job's earlier question, answered, is not taken for this one");
	assert.deepEqual(fake.collect("coordinator.wake", { id: JOB, kind: "worker", project: "elsewhere", state: "blocked", reason: "user: And the archive?" }).filter(Boolean), [], "a project not listed has no log to look in");
	rmSync(lock);
	await until("notice", () => notices().length === 2, soon);
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
	await until("closes", () => closes().length === 2, soon);
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
	await until("failures", () => printed.length === 3, soon);
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
		...[{ decided: "" }, { words: undefined }, { picked: "1" }, { message: "7" }, { message: 1.5 }].map((edit) => [JSON.stringify({ record: "answer", id: "AC-D1", time: "2026-03-04T06:00:00+01:00", decided: "Go", words: "go", ...edit }), "no decided or words, or picked or message not a number"]),
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

test("decision.entries answers a project's log as parsed, none without one; an unknown project or a line broken by hand throws", async (t) => {
	const { decision, fake, file, log } = await setup(t);
	assert.deepEqual(fake.call("decision.entries", { project: "acme" }), [], "no log yet");
	await decision(...PLAN_ASK);
	await decision("answer", "AC-D1", ...APPROVED, "ok");
	assert.equal(log()?.length, 2);
	assert.deepEqual(fake.call("decision.entries", { project: "acme" }), log());
	assert.deepEqual(fake.call("decision.entries", { project: "shop" }), [], "shop's own log, which it has not");
	assert.throws(() => fake.call("decision.entries", { project: "nowhere" }), { message: "unknown project nowhere" });
	appendFileSync(file(), "not json\n");
	assert.throws(() => fake.call("decision.entries", { project: "acme" }), { message: new RegExp(`^${file()} line 3 is not a decision record \\(not a JSON object\\)`) });
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
	await decision("answer", "AC-D4", ...APPROVE, "AC-D4 yes");
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
			'Answered 2026-03-06T13:00:00+01:00: Blue; the owner: "niebieski" (message 1)',
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
		await decision("answer", id, "--decided", decided, `${id} ok`);
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
	assert.match(printed.join("\n"), /\n### Open decisions\n\n> - AC-D8, plan, ticket AC0001, open for 2h05m: Approve the plan of the menu\?\n/);
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

// The real host's `secrets`, through the CLI: values too short and of one class for the shape rules, which only the env file names.
test("an answer quoting an env file value no enabled plugin reads, a disabled plugin's or a loose one, is written to the decision log redacted", () => {
	const folder = demo();
	const env = join(temporaryFolder(), "env");
	writeFileSync(env, "ARTHUR_SIGNAL_ACCOUNT=signalaccount\nARTHUR_LOOSE_WORD=loosewords\n");
	const signal = `{ name: "signal", options: { enabled: false, accountEnv: "ARTHUR_SIGNAL_ACCOUNT" }, setup() {} }`;
	const config = join(folder, "arthur.config.ts");
	writeFileSync(config, readFileSync(config, "utf8").replace(`timeZone: "UTC" }`, `timeZone: "UTC", envFile: ${JSON.stringify(env)} }`).replace("orchestration(), ", `orchestration(), ${signal}, `));
	const arthur = (...args: string[]) => execFileSync(process.execPath, [CLI, ...args], { cwd: folder, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME } });
	assert.equal(arthur("decision", "ask", "--kind", "question", "--question", "Which account?"), "DM-D1\n");
	const answer = ["decision", "answer", "DM-D1", "--decided", "Use signalaccount", "signalaccount, then loosewords"];
	assert.throws(() => arthur(...answer), { stderr: /^arthur decision answer: refused: no message of the owner holds these words: .*; quote his words exactly as he wrote them\n$/ }, "no owner message yet");
	ownerSaid(join(folder, ".arthur/orchestration"), 1, "Signalaccount,   then LOOSEWORDS.");
	arthur(...answer);
	const [, recorded] = readFileSync(join(folder, "spec/decisions.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual([recorded.decided, recorded.words, recorded.message], ["Use [redacted]", "[redacted], then [redacted]", 1]);
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
	await until("the ask waiting on the lock, or its end", () => existsSync(`${lock}.${asker.pid}`) || existsSync(file) || asker.exitCode !== null);
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
	said.push(await decision("answer", "AC-D1", "--decided", "Raise the line budget", "--picked", "1", "AC-D1 tak"));
	said.push(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of core by 6?", "--ticket", "AC0002", "--option", "Raise it", "--option", "Cut code", "--recommend", "Cut code"));
	said.push(await decision("answer", "AC-D2", "--decided", "raise the line  budget", "--picked", "1", "AC-D2 yes"));
	said.push(await decision("ask", "--kind", "budget", "--question", "Raise the line budget of develop by 9?"));
	said.push(await decision("answer", "AC-D3", "--decided", "Raise the line budget", "AC-D3 sure"));
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

// AR0664: approving a class is high-impact as a merge flag is; refusing one only takes authority away.
test("a class is approved only on the owner's message naming its proposal, with a notice; a refusal needs no id", async (t) => {
	const { decision, run, fake, notices } = await setup(t);
	await backed(decision);
	await decision(...PROPOSE);
	ownerSaid(fake.host.folder, 50, "tak, zawsze");
	const approve = ["answer", "AC-D4", ...APPROVE, "tak,", "zawsze"];
	assert.deepEqual(await run("decision", approve), [1, 'arthur decision answer: refused: AC-D4 approves the class budget questions naming "line budget" → Raise the line budget: the owner\'s message must name AC-D4 too, as in "AC-D4 yes"; ask him to answer with its id']);
	const before = notices().length;
	assert.equal((await run("decision", ["answer", "AC-D4", "--picked", "2", "--decided", "Refuse the class", "tak,", "zawsze"]))[0], 0);
	assert.equal(notices().length, before, "a refusal sends no notice");
	ownerSaid(fake.host.folder, 51, "AC-D4 tak, zawsze");
	assert.deepEqual((await run("decision", approve))[1], "AC-D4 answered: Pre-approve raising a line budget; the class is approved: its questions are answered by policy from now on");
	assert.deepEqual(notices().slice(before), ['Recorded as your decision AC-D4 (class, approves the class budget questions naming "line budget" → Raise the line budget): Pre-approve raising a line budget; your words: "tak, zawsze"; your message: "AC-D4 tak, zawsze"']);
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
	await decision("answer", "AC-D7", "--decided", "Raise the line budget", "AC-D7 raise");
	await decision("ask", "--kind", "budget", "--question", "Raise the line budget of github?");
	await decision("answer", "AC-D8", "--decided", "Cut code instead", "AC-D8 cut");
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
	await decision("answer", "AC-D4", ...APPROVE, "AC-D4 yes");
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
	await decision("answer", "AC-D4", ...APPROVE, "AC-D4 yes");
	await decision("answer", "AC-D5", ...APPROVE, "AC-D5 yes");
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

// AC-D1, a job's question the owner answered "Drop the table", backs AC-D2, the class of job questions naming "drop table"
// he approved; the next one is AC-D3.
async function dropClass(decision: (...args: string[]) => Promise<Ran>, blocked: (id: string, question: string) => unknown) {
	blocked(JOB, "May I drop the old orders table?");
	await decision("answer", "AC-D1", "--decided", "Drop the table", "yes, drop it");
	assert.equal((await decision("class", "propose", "--kind", "job", "--match", "drop table", "--decided", "Drop the table", "--backed-by", "AC-D1"))[0], 0);
	await decision("answer", "AC-D2", "--picked", "1", "--decided", "Pre-approve dropping tables", "AC-D2 always");
}

test("a job's question an approved class matches is answered by policy; with no record of the job blocked on it, the wake says it was not continued", async (t) => {
	const { decision, fake, log, blocked, notices } = await setup(t);
	await dropClass(decision, blocked);
	const other = "2026-03-04-worker-0000ffff";
	blocked(other, "May I drop the archive table?");
	assert.deepEqual(log()?.slice(-1), [{ record: "answer", id: "AC-D3", time: "2026-03-04T06:00:00+01:00", decided: "Drop the table", words: "by policy: AC-D2" }]);
	assert.equal(notices().at(-1), `${other} asks [AC-D3]: May I drop the archive table? — answered by policy (AC-D2): Drop the table`);
	const wake = { id: other, kind: "worker", project: "acme", state: "blocked", reason: "user: May I drop the archive table?" };
	assert.deepEqual(fake.collect("coordinator.wake", wake).filter(Boolean), [
		"Its question is decision AC-D3, answered by policy (AC-D2): Drop the table. The job was not continued by itself, since no record of it is blocked on that question; say so in your reply.",
	]);
	assert.deepEqual(fake.collect("coordinator.wake", { ...wake, id: JOB, reason: "user: May I drop the old orders table?" }).filter(Boolean), [], "a question the owner answered needs no line");
	assert.deepEqual(fake.emitted.filter((event) => event.name === "coordinator-message"), [], "no job, no continue to fail");
});

// A job of acme whose fake agent ends its run as `steps` say, acme committed first; `next`, the agent a continue starts.
async function acmeJob(t: TestContext, fake: FakeHost, acme: string, steps: AgentRun["steps"]) {
	const git = (...args: string[]) => execFileSync("git", ["-C", acme, "-c", "user.name=test", "-c", "user.email=test@example.com", ...args]);
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	const PATH = process.env.PATH;
	t.after(() => void (process.env.PATH = PATH));
	process.env.PATH = `${dirname(fakeAgent({ steps }))}${delimiter}${PATH}`;
	const job = await fake.host.jobs.spawn({ task: "Clean the database.", project: "acme" });
	const folder = join(dirname(fake.host.folder), "jobs", job.id);
	const record = (name: string) => (existsSync(join(folder, name)) ? readFileSync(join(folder, name), "utf8") : "");
	// What the job's wrapper logged, as `arthur run` delivers it.
	const logged = (name: string) => fake.host.events.read(1).filter(({ name: each, data }) => each === name && typeof data === "object" && data !== null && "id" in data && data.id === job.id);
	return { id: job.id, record, logged, next: () => void (process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: "Dropped." }] }))}${delimiter}${PATH}`) };
}

test("a job's question an approved class answers continues the job by itself, once, with the decision; the wake says so", async (t) => {
	const { decision, fake, acme, blocked, printed } = await setup(t);
	await dropClass(decision, blocked);
	const job = await acmeJob(t, fake, acme, [{ message: "Blocked: user May I drop the archive table?" }]);
	await until("the run's end", () => job.logged("job-ended").length === 1);
	job.next();
	// Its end right after its block, the first continue under way and the job still blocked: only the mark of the first keeps
	// the second from starting, quietly.
	for (const name of ["job-state", "job-ended"]) for (const event of job.logged(name)) fake.emit(name, event.data);
	assert.equal(job.record("state"), "blocked", "the end was delivered before the continue moved the job");
	assert.deepEqual(printed.filter((line) => /handler of .* failed/.test(line)), []);
	await until("the continued run's end", () => job.record("state") === "ended");
	assert.deepEqual([job.record("continue"), job.record("reason"), fake.host.jobs.result(job.id)], ["Drop the table", "finished", "Dropped."]);
	assert.equal(job.record("log").match(/\] arthur continue: /g)?.length, 1, "continued once");
	assert.deepEqual(fake.emitted.filter((event) => event.name === "coordinator-message"), []);
	assert.deepEqual(fake.collect("coordinator.wake", { id: job.id, kind: "worker", project: "acme", state: "blocked", reason: "user: May I drop the archive table?" }).filter(Boolean), [
		"Its question is decision AC-D3, answered by policy (AC-D2): Drop the table. The job is continued by policy (AC-D2) with that decision; a continue that fails comes as a message of its own. Say so in your reply.",
	]);
});

test("a job's question answered by policy once the log's lock is free, after its run's end, still continues it", async (t) => {
	const { decision, fake, acme, blocked } = await setup(t);
	await dropClass(decision, blocked);
	const job = await acmeJob(t, fake, acme, [{ message: "Blocked: user May I drop the archive table?" }]);
	await until("the run's end", () => job.logged("job-ended").length === 1);
	job.next();
	const holder = spawn("sleep", ["60"]);
	t.after(() => holder.kill());
	writeFileSync(join(fake.host.folder, "decisions-acme.lock"), String(holder.pid));
	for (const name of ["job-state", "job-ended"]) for (const event of job.logged(name)) fake.emit(name, event.data);
	assert.equal(job.record("state"), "blocked", "its end found no answer yet");
	rmSync(join(fake.host.folder, "decisions-acme.lock"));
	await until("the continued run's end", () => job.record("state") === "ended");
	assert.deepEqual([job.record("continue"), fake.host.jobs.result(job.id)], ["Drop the table", "Dropped."]);
});

test("the plugin never continues a job on the owner's own answer, nor one no longer blocked when its question is answered by policy", async (t) => {
	const { decision, fake, acme, blocked } = await setup(t);
	await dropClass(decision, blocked);
	const job = await acmeJob(t, fake, acme, [{ message: "Blocked: user May I rename the archive?" }]);
	await until("the run's end", () => job.logged("job-ended").length === 1);
	job.next();
	for (const event of job.logged("job-state")) fake.emit("job-state", event.data);
	await decision("answer", "AC-D3", "--decided", "Rename it", "yes");
	for (const event of job.logged("job-ended")) fake.emit("job-ended", event.data);
	const marked = (id: string) => existsSync(join(fake.host.folder, "continued", id));
	assert.deepEqual([marked("AC-D3"), job.record("state"), job.record("continue")], [false, "blocked", ""], "the coordinator continues it with the owner's answer");
	assert.equal(await fake.host.jobs.continue(job.id, "Rename it."), undefined);
	await until("the continued run's end", () => job.record("state") === "ended");
	// A block of its earlier run, delivered again after it ended.
	fake.emit("job-state", { id: job.id, project: "acme", ticket: null, machine: "local", from: "working", to: "blocked", reason: "user: May I drop the archive table?" });
	assert.deepEqual([(job.record("log").match(/\] arthur continue: /g) ?? []).length, marked("AC-D4"), job.record("continue")], [1, false, "Rename it."]);
});

test("a job a plugin holds in its run, its question answered by policy, is continued at its run's end", async (t) => {
	const { decision, fake, acme, blocked, notices } = await setup(t);
	await dropClass(decision, blocked);
	const gate = join(temporaryFolder(), "gate");
	t.after(() => writeFileSync(gate, ""));
	const job = await acmeJob(t, fake, acme, [{ waitFor: gate }, { message: "Never reached." }]);
	await until("its run", () => job.record("state") === "working");
	job.next();
	await fake.host.jobs.block(job.id, "May I drop the archive table?", true);
	assert.equal(notices().at(-1), `${job.id} asks [AC-D3]: May I drop the archive table? — answered by policy (AC-D2): Drop the table`);
	assert.equal(job.record("continue"), "", "held in its run: not continued yet");
	await until("the run's end", () => job.logged("job-ended").length === 1);
	for (const event of job.logged("job-ended")) fake.emit("job-ended", event.data);
	await until("the continued run's end", () => job.record("state") === "ended");
	assert.deepEqual([job.record("continue"), fake.host.jobs.result(job.id)], ["Drop the table", "Dropped."]);
});

test("a continue by policy that is refused leaves the job blocked and tells the coordinator why, with the command", async (t) => {
	const { decision, fake, acme, blocked } = await setup(t);
	await dropClass(decision, blocked);
	let refuse = false;
	fake.beforeSpawn(() => (refuse ? "no slot for it" : undefined));
	const job = await acmeJob(t, fake, acme, [{ message: "Blocked: user May I drop the archive table?" }]);
	await until("the run's end", () => job.logged("job-ended").length === 1);
	refuse = true;
	for (const event of job.logged("job-state")) fake.emit("job-state", event.data);
	const told = () => fake.emitted.filter((event) => event.name === "coordinator-message").map((event) => event.data);
	await until("the coordinator told", () => told().length === 1);
	assert.deepEqual(told(), [{ text: `${job.id} was not continued by policy (AC-D2): refused by test: no slot for it; arthur continue ${job.id} 'Drop the table' continues it with that decision.` }]);
	assert.deepEqual([job.record("state"), job.record("continue")], ["blocked", ""]);
});

test("a continue by policy whose wrapper does not start tells the coordinator why, with the command", async (t) => {
	const { decision, fake, acme, blocked } = await setup(t);
	await dropClass(decision, blocked);
	const job = await acmeJob(t, fake, acme, [{ message: "Blocked: user May I drop the archive table?" }]);
	await until("the run's end", () => job.logged("job-ended").length === 1);
	// A `systemctl` that sets any slice and a `systemd-run` that refuses the scope, first on PATH: `jobs.continue` resolves with why.
	const bin = temporaryFolder();
	writeFileSync(join(bin, "systemctl"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	writeFileSync(join(bin, "systemd-run"), "#!/bin/sh\necho 'Failed to start transient scope unit: Access denied' >&2\nexit 1\n", { mode: 0o755 });
	process.env.PATH = `${bin}${delimiter}${process.env.PATH}`;
	for (const event of job.logged("job-state")) fake.emit("job-state", event.data);
	const told = () => fake.emitted.filter((event) => event.name === "coordinator-message").map((event) => event.data);
	await until("the coordinator told", () => told().length === 1);
	const why = "systemd-run: Failed to start transient scope unit: Access denied";
	assert.deepEqual(told(), [{ text: `${job.id} was not continued by policy (AC-D2): ${why}; arthur continue ${job.id} 'Drop the table' continues it with that decision.` }]);
	assert.deepEqual([job.record("state"), job.record("reason")], ["ended", `failed: ${why}`]);
});

test("a job's question answered by policy and longer than one message is cut before what decided it; an ending that leaves no room is cut as any text", async (t) => {
	const { decision, blocked, notices } = await setup(t);
	blocked(JOB, "May I drop the old orders table?");
	await decision("answer", "AC-D1", "--decided", "Drop the table", "yes, drop it");
	await decision("class", "propose", "--kind", "job", "--match", "drop table", "--decided", "Drop the table", "--backed-by", "AC-D1");
	await decision("answer", "AC-D2", "--picked", "1", "--decided", "Pre-approve dropping tables", "AC-D2 always");
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
		await decision("answer", String(proposal), "--picked", "1", "--decided", "Pre-approve it", `${proposal} always`);
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

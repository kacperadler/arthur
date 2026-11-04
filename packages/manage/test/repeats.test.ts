import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import type { Started } from "@arthur/core/plugin";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { manage } from "../src/manage.ts";
import { RETRO_TASK } from "../src/retro.ts";

// `arthur repeats`, `/repeats` and the decisions retro against the fake host, the test providing `decision.entries` as
// orchestration would (the log as its readLog parses it) and `channel.send` as a channel would: the project acme (prefix AC),
// whose fixture log holds a standing grant, a class answering by policy, a false match of that class, a ready class, split
// picks and an override, and whose board holds a chain of finding tickets.

const PATH = process.env.PATH ?? "";
const NOW = new Date("2026-10-21T08:00:00Z");
const JOB = "2026-10-20-worker-0000abcd";
const GRANT = "If something passed review, just merge it, do not ask me";
const LOG = new URL("../../../spec/decisions.jsonl", import.meta.url);

const ask = (n: number, kind: string, question: string, options: string[], more: Record<string, unknown> = {}) => ({ record: "ask", id: `AC-D${n}`, time: `2026-10-${n < 10 ? 18 : 20}T09:00:00+02:00`, project: "acme", kind, question, options, ...(options.length > 0 ? { recommend: 1 } : {}), ...more });
const answer = (n: number, decided: string, words: string, picked?: number) => ({ record: "answer", id: `AC-D${n}`, time: "2026-10-20T10:00:00+02:00", decided, words, ...(picked === undefined ? {} : { picked }) });
const ROUND = ["Another round", "Fix or split the ticket", "Drop the branch"];
// Two of them of the security ticket AC0001, one of a ticket not on the board.
const RAISE = (n: number, from: number) => ask(n, "budget", `Raise the web line budget from ${from} to ${from + 5} for AC000${n - 5}?`, ["Raise it", "Refuse"], { ticket: n === 8 ? "AC0009" : "AC0001" });
const ENTRIES = [
	ask(1, "budget", "AC0001 needs the core line budget raised from 100 to 110: raise it?", ["Raise", "Keep"], { ticket: "AC0001" }),
	answer(1, "Raise the core line budget to 110", "AC-D1 1", 1),
	ask(2, "merge", "AC0001 passed review: merge it?", ["Merge", "Hold"], { ticket: "AC0001" }),
	answer(2, "Merge a ticket once its review passed", GRANT, 1),
	ask(3, "class", 'Pre-approve a class: merge questions naming "passed review"?', ["Approve the class", "Refuse it"], { class: { kind: "merge", match: "passed review", decided: "Merge a ticket once its review passed", backedBy: ["AC-D2"], agreed: 1, scored: 1 } }),
	answer(3, "Class approved", "AC-D3 1", 1),
	ask(4, "merge", "AC0002, which passed review: merge it?", ["Merge", "Hold"], { ticket: "AC0002" }),
	answer(4, "Merge a ticket once its review passed", "by policy: AC-D3"),
	ask(5, "merge", "Merge AC0003? Docs only, so no review ran; checks passed", ["Merge", "Hold"], { ticket: "AC0003" }),
	answer(5, "Merge a ticket once its review passed", "by policy: AC-D3"),
	...[6, 7, 8].flatMap((n) => [RAISE(n, 100 + n * 10), answer(n, "Raise the web line budget by what the fix needs", `AC-D${n} 1`, 1)]),
	ask(9, "question", "Which colour for the menu?", ["Blue, the brand's", "Red"]),
	answer(9, "The menu is red", "AC-D9 2", 2),
	...[10, 11, 12].flatMap((n) => [ask(n, "review", `AC0002 failed review twice (round ${n}): another round?`, ROUND), answer(n, n === 12 ? "AC0002: split it" : "AC0002: another round", `AC-D${n} ${n === 12 ? 2 : 1}`, n === 12 ? 2 : 1)]),
	ask(13, "job", "May the core line budget go from 120 to 130?", [], { job: JOB, ticket: "AC0002" }),
	{ record: "close", id: "AC-D13", time: "2026-10-20T11:00:00+02:00", reason: "job ended" },
	ask(14, "question", "Start AC0004 now?", ["Start", "Wait"]),
	answer(14, "AC0004 starts now", `${GRANT}, again`, 1),
	ask(15, "question", "Which font?", ["Serif", "Sans"]),
];

const ticket = (id: string, date: string, more = "") => `# ${id} - T\n\n\`\`\`json\n{\n  "id": "${id}",\n  "date": "${date}"\n}\n\`\`\`\n\n## Goal\n\nIt.\n\n- Kind: security\n\n## Decisions\n\n${more}\n`;
const BOARD: [string, string, string, Record<string, string>][] = [
	["AC0001", "merged", ticket("AC0001", "2026-10-17", "- 2026-10-17: Coordinator: core 100 to 110, web 50 to 60, budget raises accepted."), {}],
	["AC0002", "merged", ticket("AC0002", "2026-10-19", "- 2026-10-19: Source: F1 of AC0001\n- 2026-10-19: core line budget 110 -> 120."), { "review-1.md": "- Verdict: FAIL\n", "review-2.md": "- Verdict: FAIL\n", "review-3.md": "- Verdict: PASS\n" }],
	["AC0003", "dropped", ticket("AC0003", "2026-10-20", "- 2026-10-20: Source: F2 of AC0002"), { "review-1.md": "- Verdict: FAIL\n" }],
	["AC0004", "dropped", ticket("AC0004", "2026-10-20", "- 2026-10-20: core 70 to 90 lines of tests, in their own files."), {}],
];

async function load(t: TestContext, entries: readonly unknown[] | (() => never) = ENTRIES) {
	const root = join(temporaryFolder(), "acme");
	for (const name of ["core", "web"]) mkdirSync(join(root, "packages", name), { recursive: true });
	const board = BOARD.map(([id, status, text, files]) => {
		const folder = `spec/features/${id}-t`;
		mkdirSync(join(root, folder), { recursive: true });
		for (const [name, content] of Object.entries({ "ticket.md": text, ...files })) writeFileSync(join(root, folder, name), content);
		return { id, title: `Ticket ${id}`, status, path: `${folder}/ticket.md`, updated: "2026-10-20T10:00:00Z" };
	});
	writeFileSync(join(root, "spec/build.json"), JSON.stringify(board));
	writeFileSync(join(root, "spec/vision.md"), "# Vision\n");
	execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: root });
	execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"], { cwd: root });
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: "NO PROPOSALS" }] }))}${delimiter}${PATH}`;
	t.after(() => {
		process.env.PATH = PATH;
	});
	const fake = fakeHost({ name: "manage", now: NOW, root });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	fake.provide("decision.entries", ({ project }: { project: string }) => (typeof entries === "function" ? entries() : project === "acme" ? entries : []));
	await fake.setup(manage({}));
	const command = async (...args: string[]) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === "repeats")?.run({ args, project: undefined })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
	const home = dirname(fake.host.folder);
	const read = (id: string, name: string) => readFileSync(join(home, "jobs", id, name), "utf8");
	return { root, fake, command, read, retros: () => fake.host.jobs.list().filter((job) => job.kind === "retro") };
}

const section = (digest: string, heading: string) => digest.split(`\n${heading}\n\n`)[1]?.split(/\n#{2,3} /)[0];

test("the digest: decisions by kind and who answered, the policy class, the grant, the closed and the open ask", async (t) => {
	const { out, code } = await (await load(t)).command();
	assert.equal(code, 0);
	assert.ok(out.startsWith("# Repeats of acme\n\nSince the start.\n\n## Decisions by kind and by who answered\n\nAC-D1 to AC-D15, 2026-10-18 to 2026-10-20: 15 asks, 13 answered, 1 closed, 1 open.\n\n"), out);
	assert.equal(
		section(out, "AC-D1 to AC-D15, 2026-10-18 to 2026-10-20: 15 asks, 13 answered, 1 closed, 1 open.")?.split("\n\n")[0],
		[
			"- budget: 4 asks; policy 0, standing grant 0, owner 4, closed 0, open 0; agreement 4 of 4 (100.0%)",
			"- merge: 3 asks; policy 2, standing grant 1, owner 0, closed 0, open 0; agreement 1 of 1 (100.0%)",
			"- question: 3 asks; policy 0, standing grant 1, owner 1, closed 0, open 1; agreement 1 of 2 (50.0%)",
			"- review: 3 asks; policy 0, standing grant 0, owner 3, closed 0, open 0; agreement 2 of 3 (66.7%)",
			"- job: 1 ask; policy 0, standing grant 0, owner 0, closed 1, open 0; agreement 0 of 0",
			"- All 14 but the class proposals: policy 2 of 14 (14.3%), standing grant 2 of 14 (14.3%), owner 8 of 14 (57.1%), closed 1 of 14 (7.1%), open 1 of 14 (7.1%); agreement 8 of 10 (80.0%)",
			"- Classes, as they stand now: AC-D3 approved",
		].join("\n"),
	);
	assert.equal(section(out, "## Standing grants"), `- first AC-D2, "${GRANT}": 2 answers (merge 1, question 1): AC-D2, AC-D14\n`, "an answer whose words begin as an earlier grant's goes under it");
	const fix = '- AC-D12 review: picked 2, "Fix or split the ticket" over 1, "Another round": "AC0002 failed review twice (round 12): another round?"';
	assert.equal(section(out, "## The owner's overrides of the recommendation"), `2 of 10 (20.0%) scored answers picked another option than the recommended one:\n- AC-D9 question: picked 2, "Red" over 1, "Blue, the brand's": "Which colour for the menu?"\n${fix}\n`);
	assert.equal(section(out, "## Loose class matches"), '- AC-D5 answered by AC-D3, whose words "passed review" it names apart, not as one phrase: "Merge AC0003? Docs only, so no review ran; checks passed"\n', "the false match, and not AC-D4 whose question holds the phrase");
});

// Classes beside AC-D3: one of security tickets, approved; one refused; one proposed and never answered.
const CLASSES = [
	ask(16, "class", "Pre-approve web budgets?", ["Approve the class", "Refuse it"], { class: { kind: "budget", match: "web line budget", decided: "Raise it", backedBy: ["AC-D6"], ticketKind: "security", agreed: 1, scored: 1 } }),
	answer(16, "Class approved", "AC-D16 1", 1),
	ask(17, "class", "Pre-approve fonts?", ["Approve the class", "Refuse it"], { class: { kind: "question", match: "font", decided: "Serif", backedBy: ["AC-D15"], agreed: 0, scored: 0 } }),
	answer(17, "Class refused", "AC-D17 2", 2),
	ask(18, "class", "Pre-approve colours?", ["Approve the class", "Refuse it"], { class: { kind: "question", match: "colour", decided: "Red", backedBy: ["AC-D9"], agreed: 0, scored: 0 } }),
];
// A shape whose every ask was closed, one whose questions share no word, and one answered only by a class that names none of
// its asks (they are of a ticket off the board, the class of security tickets): no answer of the owner backs a class there.
const CLOSED = [19, 20, 21].flatMap((n) => [ask(n, "job", `Hold job ${n}?`, ["Hold", "Continue"]), { record: "close", id: `AC-D${n}`, time: "2026-10-20T11:00:00+02:00", reason: "job ended" }]);
const APART = [22, 23, 24].flatMap((n, at) => [ask(n, "question", ["Ship it?", "Deploy today?", "Release now?"][at] ?? "", ["Yes", "No"]), answer(n, "Go", `AC-D${n} yes`, 1)]);
const POLICY = [26, 27, 28].flatMap((n) => [ask(n, "budget", `Grow the web line budget by ${n}?`, ["Grow", "Shrink"], { ticket: "AC0009" }), answer(n, "Raise it", "by policy: AC-D16")]);

test("repeated shapes: a ready class proposal, picks split as a code default, a shape a class covers, and why no class fits", async (t) => {
	const policy = [ask(25, "merge", "AC0004 passed review: merge it?", ["Merge", "Hold"]), answer(25, "Merge a ticket once its review passed", "by policy: AC-D3")];
	const { out } = await (await load(t, [...ENTRIES, ...CLASSES, ...CLOSED, ...APART, ...policy, ...POLICY])).command();
	const shapes = out.split("\n### ").slice(1).map((each) => each.split("\n\n## ")[0]?.trim());
	assert.deepEqual(shapes.map((each) => each?.split("\n")[0]), ["1. `merge: merge / hold`: 4 asks", "2. `budget: raise it / refuse`: 3 asks", "3. `review: another round / fix or / drop the`: 3 asks", "4. `job: hold / continue`: 3 asks", "5. `question: yes / no`: 3 asks", "6. `budget: grow / shrink`: 3 asks"]);
	assert.match(shapes[5] ?? "", /\n- Answered: policy 3, standing grant 0, owner 0, closed 0, open 0\n.*\n- Class: none\n/s);
	assert.ok(shapes[5]?.endsWith("\n- Candidate: no answer by the owner or a grant to back a class"), "answers by policy never back a class");
	assert.equal(
		shapes[1]?.split("\n\n")[1],
		[
			'- First asked: AC-D6, "Raise the web line budget from 160 to 165 for AC0001?"',
			"- Answered: policy 0, standing grant 0, owner 3, closed 0, open 0",
			'- Picks: "raise it" 3',
			"- Agreement with the recommendation: 3 of 3 (100.0%)",
			"- Examples: AC-D6, AC-D7, AC-D8",
			"- Class: AC-D16 approved (security tickets), names 2 of 3",
			"- Candidate: `arthur decision class propose --project acme --kind budget --match 'raise the web line budget from to for' --decided 'Raise the web line budget by what the fix needs' --backed-by AC-D6 AC-D7 AC-D8`",
		].join("\n"),
		"the class of security tickets names the two asks of AC0001, not the one of a ticket off the board",
	);
	assert.match(shapes[2] ?? "", /\n- Picks: "another round" 2, "fix or" 1\n.*\n- Candidate: picks split: a code default$/s);
	assert.match(shapes[0] ?? "", /\n- Answered: policy 3, standing grant 1, owner 0, closed 0, open 0\n/);
	assert.match(shapes[0] ?? "", /\n- Class: AC-D3 approved, names 4 of 4\n- Candidate: covered by AC-D3$/, "the docs-only ask names both words apart, so the class's word rule names it too (the loose match)");
	assert.ok(shapes[3]?.endsWith("\n- Candidate: no answer by the owner or a grant to back a class"), shapes[3]);
	assert.ok(shapes[4]?.endsWith("\n- Candidate: no word common to every question: no class matches them all"), shapes[4]);
	assert.match(out, /\n- Classes, as they stand now: AC-D3 approved, AC-D16 approved, AC-D17 refused, AC-D18 proposed\n/);
	const two = await (await load(t, ENTRIES.filter((each) => !["AC-D7", "AC-D8"].includes(String(each.id))).concat([RAISE(7, 170), answer(7, "Raise it", "AC-D7 1", 1), RAISE(8, 180), answer(8, "Raise the web budget", "AC-D8 1", 1)]))).command();
	assert.match(two.out, /\n- Candidate: decided texts differ: one fresh owner answer backs a class\n/, "3 asks with 3 different decisions is no class");
});

test("the recurring issues of the ticket history: finding chains, FAILs, blocked jobs by cause, budgets per package, drops", async (t) => {
	const jobs = [ask(16, "job", "merge-checks.ts is 204 lines, over the 200-line limit: may it stay?", [], { job: JOB }), ask(17, "job", "Should AC0004 be closed as done?", [], { job: JOB })];
	const env = await load(t, [...ENTRIES, ...jobs]);
	const { out } = await env.command();
	assert.equal(
		section(out, "## Recurring issues"),
		[
			"- Tickets from findings: 2 of 4 (50.0%) come from a finding (`Source: F<n> of <ticket>`); the longest chain, 2 deep: AC0003 ← AC0002 ← AC0001",
			"- Tickets with 2 or more FAIL reviews: 1; most: AC0002 2",
			"- Jobs blocked on the owner: 3 questions: line budget 1 (AC-D13), file size 1 (AC-D16), other 1 (AC-D17)",
			"- Line budgets under the tickets' Decisions, tickets per package: core 2, web 1",
			"- Drops: 2 tickets: from a finding 1, other 1",
		].join("\n"),
	);
	// A hand edit that makes AC0004 come from itself ends its chain there.
	writeFileSync(join(env.root, "spec/features/AC0004-t/ticket.md"), ticket("AC0004", "2026-10-20", "- 2026-10-20: Source: F1 of AC0004"));
	assert.match((await env.command()).out, /\n- Tickets from findings: 3 of 4 \(75\.0%\) come from a finding \(`Source: F<n> of <ticket>`\); the longest chain, 2 deep: AC0003 ← AC0002 ← AC0001\n/);
	rmSync(join(env.root, "packages"), { recursive: true });
	assert.match((await env.command()).out, /\n- Line budgets under the tickets' Decisions, tickets per package: no packages\/ folder\n/);
});

test("--since a date or a decision id narrows the asks and the tickets; an unknown id refuses; wrong usage exits 2", async (t) => {
	const env = await load(t);
	const since = await env.command("--since", "2026-10-20");
	assert.match(since.out, /^# Repeats of acme\n\nSince 2026-10-20\.\n\n## Decisions by kind and by who answered\n\nAC-D10 to AC-D15, 2026-10-20 to 2026-10-20: 6 asks, /);
	assert.match(since.out, /\n- Tickets from findings: 1 of 2 \(50\.0%\) come from a finding/, "only the tickets made that day or later");
	assert.match((await env.command("--since", "AC-D9")).out, /\n\nAC-D9 to AC-D15, 2026-10-18 to 2026-10-20: 7 asks, /);
	assert.match((await env.command("--since", "2026-11-01")).out, /^# Repeats of acme\n\nSince 2026-11-01\.\n\n## Decisions\n\nNone in the log\.\n\n## Recurring issues\n\n- Tickets from findings: 0 of 0 come/);
	await assert.rejects(env.command("--since", "AC-D99"), { message: "no decision AC-D99 in the log of project acme" });
	const usage = "usage: arthur repeats [--project <name>] [--since <date|decision id>], or arthur repeats [--project <name>] --retro ['<focus>']";
	for (const args of [["now"], ["--since"], ["--since", "yesterday"], ["--since", "2026-10-20", "--retro"], ["--retro", "a", "b"], ["--color"]]) assert.deepEqual(await env.command(...args), { code: 2, out: "", err: usage }, args.join(" "));
	await assert.rejects(Promise.try(() => env.fake.commands.find((each) => each.name === "repeats")?.run({ args: [], project: "nope" })), /unknown project nope; projects: acme/);
	assert.equal(env.retros().length, 0, "no wrong usage started a retro");
});

test("a log orchestration cannot read, or no orchestration, fails the command with its reason", async (t) => {
	const broken = await load(t, () => {
		throw new Error("spec/decisions.jsonl line 3 is not a decision record (not a JSON object)");
	});
	await assert.rejects(broken.command(), { message: /line 3 is not a decision record/ });
	const empty = await load(t, []);
	assert.match((await empty.command()).out, /^# Repeats of acme\n\nSince the start\.\n\n## Decisions\n\nNone in the log\.\n\n## Recurring issues\n/);
});

test("/repeats sends the digest as a page in the report style from manage's own folder; red only for the overrides and loose matches", async (t) => {
	const { fake } = await load(t);
	const sent: unknown[] = [];
	// A channel as docs/commands/send.md describes one: it checks the message and throws a refusal, or answers its send.
	fake.provide("channel.send", (message: { files: string[]; place?: string }) => {
		if (message.files.some((file) => !existsSync(file))) throw new Error(`${message.files[0]}: no such file`);
		return async () => (sent.push(message), "sent 1 file in 1 message");
	});
	const file = join(fake.host.folder, "repeats-2026-10-21.html");
	assert.equal(await fake.host.commands.route("/repeats", { channel: "test", place: "7" }), "repeats-2026-10-21.html: test: sent 1 file in 1 message");
	assert.deepEqual(sent, [{ files: [file], place: "7" }]);
	assert.deepEqual(readdirSync(fake.host.folder).filter((name) => name.startsWith("repeats")), ["repeats-2026-10-21.html"], "written whole, no temporary file left");
	const page = readFileSync(file, "utf8");
	assert.match(page, /^<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Repeats of acme<\/title><style>:root\{--ink:#0a0a0a;--paper:#ffffff;--grey:#f2f2f2;--blue:#0033ff;--red:#d40000;/);
	const style = /<style>(.*)<\/style>/.exec(page)?.[1] ?? "";
	for (const rule of ["body{margin:0;background:var(--paper);color:var(--ink);", "main{max-width:900px;margin:0 auto;", "code{font:13px ui-monospace,Menlo,monospace;background:var(--grey);color:var(--ink);", ".red{color:var(--red)}"]) assert.ok(style.includes(rule), rule);
	assert.doesNotMatch(style, /#000[;}]|#1d4ed8|#b91c1c|46em|prefers-color-scheme/, "none of the old colours or layout");
	assert.match(page, /<body>\n<header>\n<h1>Repeats of acme<\/h1>\n<p>Since the start\.<\/p>\n<\/header>\n<main>\n<h2>Decisions by kind and by who answered<\/h2>\n/);
	assert.ok(page.endsWith("</ul>\n</main>\n</body></html>\n"), page.slice(-80));
	const red = ['AC-D9 question: picked 2, "Red" over 1, "Blue, the brand\'s": "Which colour for the menu?"', 'AC-D12 review: picked 2, "Fix or split the ticket"', 'AC-D5 answered by AC-D3, whose words "passed review" it names apart, not as one phrase: "Merge AC0003? Docs only, so no review ran; checks passed"'];
	assert.deepEqual(page.match(/<li class="red">[^<]*/g)?.map((line, at) => line.startsWith(`<li class="red">${red[at]}`)), [true, true, true], "the two overrides and the loose match, nothing else");
	assert.ok(page.includes("<h2>Repeated shapes</h2>") && page.includes("<ul>\n<li>budget: 4 asks;"), page);
	assert.ok(page.includes("<code>arthur decision class propose --project acme --kind budget --match 'raise the web line budget from to for'"), "a backticked span is code");
	assert.equal(await fake.host.commands.route("/repeats", { channel: "telegram" }), "repeats-2026-10-21.html not sent: telegram provides no channel.send");
	assert.equal(await fake.host.commands.route("/repeats now"), "usage: /repeats [retro [<focus>]]");
});

test("--retro and /repeats retro start the retro kind with the focus on decisions, its prompt holding the digest; /retro starts none", async (t) => {
	const env = await load(t);
	const started = await env.command("--retro", "budget asks");
	const [first] = env.retros();
	assert.ok(first !== undefined);
	assert.deepEqual(started, { code: 0, out: `retro: started job ${first.id}`, err: "" });
	assert.equal(env.read(first.id, "task"), `${RETRO_TASK}\n\nFocus: decisions: budget asks`);
	const prompt = env.read(first.id, "prompt");
	const repeats = prompt.slice(prompt.indexOf("### Repeats of acme"), prompt.indexOf("### Board"));
	assert.ok(repeats.startsWith("### Repeats of acme\n\nSince the start.\n\n#### Decisions by kind and by who answered\n\nAC-D1 to AC-D15"), repeats);
	assert.ok(repeats.includes("\n##### 1. `merge: merge / hold`: 3 asks\n") && repeats.includes("\n#### Recurring issues\n"), "its headings two levels down, under the retro's own");
	const answer = await env.fake.host.commands.route("/repeats retro", { channel: "test" });
	const second = env.retros().find((job) => job.id !== first.id);
	assert.equal(answer, `retro: started job ${second?.id}`);
	assert.equal(env.read(second?.id ?? "", "task"), `${RETRO_TASK}\n\nFocus: decisions`);
	await env.fake.host.commands.route("/retro", { channel: "test" });
	assert.equal(env.retros().length, 2, "/retro alone sends a page and starts no job");
	env.fake.beforeSpawn(() => "maxAgents reached");
	await assert.rejects(env.command("--retro"), { message: /refused by test: maxAgents reached/ });
	const failed = { id: "2026-10-21-retro-0000abcd", failed: "systemd-run exited 1" } as unknown as Started;
	t.mock.method(env.fake.host.jobs, "spawn", async () => failed);
	assert.equal(await env.fake.host.commands.route("/repeats retro"), "/repeats failed: job 2026-10-21-retro-0000abcd did not start: systemd-run exited 1");
});

test("a retro whose decision log cannot be read still starts, the Repeats section saying why", async (t) => {
	const env = await load(t, () => {
		throw new Error("unknown project acme");
	});
	const job = await env.fake.host.jobs.spawn({ task: RETRO_TASK, kind: "retro" });
	assert.ok(env.read(job.id, "prompt").includes("\n### Repeats\n\nnot read: unknown project acme\n\n### Board\n"));
});

test("a retro after a filed one gets the digest from the day of that retro's commit", async (t) => {
	const env = await load(t);
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: env.root, encoding: "utf8", env: { ...process.env, GIT_COMMITTER_DATE: "2026-10-20T12:00:00+02:00" } }).trim();
	git("commit", "--quiet", "--allow-empty", "-m", "the commit the last retro looked back from");
	mkdirSync(join(env.root, "spec/retro"));
	writeFileSync(join(env.root, "spec/retro/2026-10-20.md"), `# Retro 2026-10-20\n\n- Merges up to: ${git("rev-parse", "HEAD")}\n`);
	git("add", "--all");
	git("commit", "--quiet", "-m", "the last retro");
	const job = await env.fake.host.jobs.spawn({ task: RETRO_TASK, kind: "retro" });
	assert.match(env.read(job.id, "prompt"), /\n### Repeats of acme\n\nSince 2026-10-20\.\n\n#### Decisions by kind and by who answered\n\nAC-D10 to AC-D15, /);
});

test("this repository's own log, AR-D1 to AR-D335, reproduces the counts of the hand analysis (AR0561 audit/decisions.md)", async (t) => {
	const entries = readFileSync(LOG, "utf8").split("\n").slice(0, 673).map((line) => JSON.parse(line));
	const { out } = await (await load(t, entries)).command();
	const kinds = section(out, "AR-D1 to AR-D335, 2026-10-25 to 2026-10-29: 335 asks, 319 answered, 16 closed, 0 open.")?.split("\n\n")[0];
	assert.equal(
		kinds,
		[
			"- merge: 104 asks; policy 68, standing grant 7, owner 15, closed 14; agreement 22 of 22 (100.0%)",
			"- question: 94 asks; policy 0, standing grant 25, owner 68, closed 1; agreement 87 of 91 (95.6%)",
			"- budget: 55 asks; policy 17, standing grant 28, owner 10, closed 0; agreement 37 of 37 (100.0%)",
			"- review: 38 asks; policy 0, standing grant 17, owner 21, closed 0; agreement 38 of 38 (100.0%)",
			"- job: 30 asks; policy 0, standing grant 9, owner 21, closed 0; agreement 19 of 23 (82.6%)",
			"- plan: 10 asks; policy 0, standing grant 0, owner 10, closed 0; agreement 9 of 9 (100.0%)",
			"- All 331 but the class proposals: policy 85 of 331 (25.7%), standing grant 86 of 331 (26.0%), owner 145 of 331 (43.8%), closed 15 of 331 (4.5%); agreement 212 of 220 (96.4%)",
			"- Classes, as they stand now: AR-D62 closed, AR-D63 approved, AR-D74 revoked, AR-D218 approved",
		].join("\n"),
	);
	assert.match(out, /\n### 2\. `merge: merge \/ wait`: 28 asks\n(?:\n- .*)*\n- Class: AR-D218 approved, names 13 of 28\n- Candidate: decided texts differ: one fresh owner answer backs a class\n/, "the class's words miss the merges asked after a PASS");
	const shapes = [...out.matchAll(/^### \d+\. `([^`]+)`: (\d+) asks$/gm)].map(([, name, count]) => `${count} ${name}`);
	assert.deepEqual(shapes.slice(0, 9), ["46 merge: merge now / wait", "28 merge: merge / wait", "27 question: approve / not now", "26 review: another round / fix or / drop the", "21 merge: merge / hold", "20 budget: raise / keep", "18 question: approve / hold", "8 budget: accept # / ask the", "7 merge: merge now / hold it"]);
	assert.deepEqual(shapes.slice(9).map((each) => Number(each.split(" ")[0])), [5, 4, 3, 3, 3, 3], "the budget shapes 20 + 8 + 5 + 4 + 3 + 3 (+3) and the 3 queue approvals");
	assert.match(out, /\n- first AR-D61, "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS": 19 answers \(budget 19\): /);
	assert.match(out, /\n- under AR-D271, "[^"]*": 17 answers \(job 4, budget 8, review 5\): /);
	assert.match(out, /\n- first AR-D242, "[^"]*": 5 answers \(question 2, review 3\): AR-D242, AR-D243, AR-D244, AR-D245, AR-D246\n/, "the answers naming AR-D242 join the group it began");
	assert.match(out, /\n8 of 220 \(3\.6%\) scored answers picked another option than the recommended one:\n- AR-D2 question: .*\n- AR-D13 .*\n- AR-D97 .*\n- AR-D198 .*\n- AR-D199 .*\n- AR-D257 .*\n- AR-D300 .*\n- AR-D326 /);
	assert.equal(section(out, "## Loose class matches")?.split("\n").filter(Boolean).map((line) => line.split(" ")[1]).join(), "AR-D205", "the one false match, AR-D205");
});

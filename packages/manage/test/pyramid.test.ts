import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder, until } from "@arthur/core/testing";
import { AUDIT_TASK } from "../src/audit.ts";
import { type ManageOptions, manage } from "../src/manage.ts";
import { PYRAMID_TASK } from "../src/pyramid.ts";

// The pyramid audit against the fake host and the fake agent: the repository `acme` (prefix AC) with a board, `beta` (BE), a
// repository without one, and `gamma` (GA), with a board of its own.

const PATH = process.env.PATH ?? "";
const NOW = new Date("2026-10-21T02:00:00Z");
const PROCEDURE = readFileSync(new URL("../roles/coordinator/pyramid-ended.md", import.meta.url), "utf8").trim();
const MESSAGE = [
	"## Layers",
	"",
	"3 corrections at human review & <none> at static analysis.",
	"",
	"## 1. A type for the port",
	"Corrections:",
	"- AC0001 review-1.md: the port was a `string`",
	"Now at: human review",
	"Move to: codebase",
	"Kind: refactor",
	"Before:",
	"> port: string",
	">",
	"> // <any>",
	"After:",
	"> port: Port",
	"Dead prose: none",
	"",
	"## Dead prose",
	"",
	"none",
].join("\n");

async function load(t: TestContext, options: ManageOptions = {}, run: AgentRun = { steps: [{ message: MESSAGE }] }) {
	const folder = temporaryFolder();
	const git = (root: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: root, encoding: "utf8" }).trim();
	const commit = (root: string, message: string) => {
		git(root, "add", "--all");
		git(root, "commit", "--quiet", "--allow-empty", "-m", message);
		return git(root, "rev-parse", "HEAD");
	};
	const [root, beta, gamma] = ["acme", "beta", "gamma"].map((name) => {
		const path = join(folder, name);
		mkdirSync(join(path, "spec"), { recursive: true });
		writeFileSync(join(path, "spec/vision.md"), "# Vision\n");
		if (name !== "beta") writeFileSync(join(path, "spec/build.json"), "[]");
		git(path, "init", "--quiet", "--initial-branch=main");
		commit(path, "first");
		return path;
	}) as [string, string, string];
	process.env.PATH = `${dirname(fakeAgent(run))}${delimiter}${PATH}`;
	t.after(() => {
		process.env.PATH = PATH;
	});
	const fake = fakeHost({ name: "manage", options, now: NOW, root });
	fake.provide("projects", () => [
		{ name: "acme", path: root, prefix: "AC" },
		{ name: "beta", path: beta, prefix: "BE" },
		{ name: "gamma", path: gamma, prefix: "GA" },
	]);
	await fake.setup(manage(options));
	const home = dirname(fake.host.folder);
	const read = (id: string, name: string) => (existsSync(join(home, "jobs", id, name)) ? readFileSync(join(home, "jobs", id, name), "utf8") : "");
	// A command as the CLI runs it, with what it printed; a refusal rejects, which the CLI prints with exit 1.
	const command = async (project: string | undefined, ...args: string[]) => {
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const code = await Promise.try(() => fake.commands.find((each) => each.name === "pyramid")?.run({ args, project })).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
	const started = (line: string) => /^pyramid: started job (\S+)$/.exec(line)?.[1] ?? assert.fail(line);
	const ended = (id: string) => until(`${id} to end`, () => read(id, "state") === "ended");
	// A pyramid of acme spawned, and its prompt's own section.
	const section = async () => {
		const job = await fake.host.jobs.spawn({ task: PYRAMID_TASK, kind: "pyramid" });
		const prompt = read(job.id, "prompt");
		return prompt.slice(prompt.indexOf("## This pyramid audit"));
	};
	// A retro of `project` in a run, then held: on the owner with `stop`, else on a dependency; its id.
	const held = async (project: string, reason: string, stop: boolean) => {
		const job = await fake.host.jobs.spawn({ task: "Look back.", kind: "retro", project });
		await fake.host.jobs.block(job.id, reason, stop);
		const want = `${stop ? "user" : "dependency"}: ${reason}`;
		await until(`${job.id} held`, () => fake.host.jobs.list().some((each) => each.id === job.id && each.state === "blocked" && each.reason === want));
		return job.id;
	};
	return { root, beta, gamma, home, fake, git, commit, read, command, started, ended, section, held, jobs: fake.host.jobs };
}

test("refused for a project without a board and while one runs for that project; another project, another kind, or after its end is not", async (t) => {
	const gate = join(temporaryFolder(), "gate");
	const env = await load(t, {}, { steps: [{ waitFor: gate }, { message: MESSAGE }] });
	const noBoard = `refused by manage: project beta has no board, ${join(env.beta, "spec/build.json")}: arthur init beta first`;
	await assert.rejects(env.command("beta"), { message: noBoard });
	assert.equal(await env.fake.host.commands.route("/pyramid beta"), `/pyramid failed: ${noBoard}`);
	const first = env.started((await env.command(undefined, "flaky tests")).out);
	assert.deepEqual([env.read(first, "task"), env.read(first, "branch")], [`${PYRAMID_TASK}\n\nFocus: flaky tests`, ""]);
	const busy = `refused by manage: a pyramid audit of acme runs already: job ${first}; wait for its end, or arthur stop ${first}`;
	await assert.rejects(env.command("acme"), { message: busy });
	await assert.rejects(env.jobs.spawn({ task: "x", kind: "pyramid" }), { message: busy }, "arthur spawn --kind pyramid too");
	assert.equal(await env.fake.host.commands.route("/pyramid"), `/pyramid failed: ${busy}`);
	const other = env.started(await env.fake.host.commands.route("/pyramid gamma the CI"));
	assert.deepEqual([env.read(other, "task"), env.jobs.list().find((job) => job.id === other)?.project], [`${PYRAMID_TASK}\n\nFocus: the CI`, "gamma"]);
	await env.jobs.spawn({ task: "Look back.", kind: "retro" });
	await assert.rejects(env.jobs.spawn({ task: "x", kind: "pyramid" }), { message: busy }, "a retro in a run is no pyramid");
	writeFileSync(gate, "");
	await env.ended(first);
	const after = env.started(await env.fake.host.commands.route("/pyramid  why so many steers? "));
	assert.equal(env.read(after, "task"), `${PYRAMID_TASK}\n\nFocus: why so many steers?`, "a first word naming no project is the focus");
	await env.ended(after);
	assert.equal(env.read(env.started((await env.command(undefined)).out), "task"), PYRAMID_TASK, "no focus, the task alone");
	assert.deepEqual(await env.command(undefined, "a", "b"), { code: 2, out: "", err: "usage: arthur pyramid [--project <name>] ['<focus>']" });
	assert.deepEqual(await env.command(undefined, "--deep"), { code: 2, out: "", err: "usage: arthur pyramid [--project <name>] ['<focus>']" });
});

test("a project with no Arthur history: every ledger section none, and the line that sends the job to its git log", async (t) => {
	const env = await load(t, { pyramid: { budgetUsd: 4 } });
	const job = env.started((await env.command(undefined)).out);
	assert.equal(env.read(job, "budget"), "4");
	const prompt = env.read(job, "prompt");
	assert.match(prompt, /^# Pyramid\n\n## Your job\n/);
	const section = prompt.slice(prompt.indexOf("## This pyramid audit"));
	const base = env.read(job, "base");
	assert.ok(
		section.startsWith(
			`## This pyramid audit\n\nYou audit project acme at ${base}; your worktree is a detached checkout of that commit.\n\nNo Arthur history: no correction is recorded. Read the repository and its git log instead: its fix-up, revert and review commits are its corrections.\n\n### FAIL reviews\n\nnone\n\n### Open and deferred findings\n\nnone\n\n### Repeats\n\nnot read: `,
		),
		section,
	);
	assert.ok(section.includes("### Blocked on the owner\n\nnone\n\n### Corrections\n\nSteers and continues of the project's jobs, by first sentence, most frequent first:\n\nnone\n\n### Prose\n\nThe files agents read, the plugins' roles, procedures and criteria first:\nnone\n\n"), section);
	assert.ok(section.includes("### Checks\n\nScripts:\nnone\n\nCI, type and lint configs:\nnone\n\nTests: 0 test files, 0 tests\n\n### Board\n\n"), section);
});

test("a project with history: its FAIL reviews, open and deferred findings, repeats, blocked questions and steers; its prose, checks and tests", async (t) => {
	const gate = join(temporaryFolder(), "gate");
	const env = await load(t, {}, { steps: [{ waitFor: gate }] });
	const { root } = env;
	const file = (path: string, text: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	};
	const entry = (id: string) => ({ id, title: `Ticket ${id}`, status: "merged", path: `spec/features/${id}-t/ticket.md`, updated: "2026-10-20T10:00:00Z" });
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([entry("AC0001"), entry("AC0002")]));
	for (const [name, verdict] of [["review-1.md", "FAIL"], ["review-2.md", "PASS"], ["review-10.md", "FAIL"]]) file(`spec/features/AC0001-t/${name}`, `# Review\n\n- Verdict: ${verdict}\n`);
	file("spec/features/AC0002-t/review-1.md", "# Review\n\n- Verdict: PASS\n");
	file("spec/features/AC0099-gone/review-1.md", "# Review\n\n- Verdict: FAIL\n");
	file("spec/features/AC0002-t/plan-review-1.md", "# Plan review\n\n- Verdict: FAIL\n");
	file("spec/features/AC0001-t/findings.md", "## F1. Open one\n\n- Kind: bug\n- Status: open\n\n## F2. Fixed\n\n- Status: fixed in abc\n\n## F3. Deferred\n\n- Kind: risk\n- Where: `a.ts:1`\n- Status: deferred (client summary)\n");
	file("AGENTS.md", "one\ntwo\nthree\n");
	file("packages/x/CLAUDE.md", "one");
	file(".claude/rules/tests.md", "a\nb\n");
	file("docs/Styleguide.md", "s\n");
	file("README.md", "not prose agents are told to read\n");
	file("package.json", JSON.stringify({ scripts: { test: "node --test", check: "tsc" } }));
	file("packages/x/package.json", "{ broken");
	file(".github/workflows/ci.yml", "on: push\njobs: {}\n");
	file("tsconfig.json", "{}\n");
	file("test/a.test.ts", 'test("one", () => {});\n\ttest.skip("two", () => {});\nit("three");\nconst latest = 1;\n');
	file("tests/test_b.py", "def test_one():\n    pass\n");
	file("src/a.ts", 'test("not in a test file");\n');
	file("roles/worker.md", "# Worker\n\nWork.\n");
	env.commit(root, "history");
	file("CONTRIBUTING.md", "not committed\n");
	const plugin = fakeHost({ name: "manage", now: NOW, root, code: [root] });
	plugin.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	plugin.provide("decision.entries", () => []);
	await plugin.setup(manage({}));
	const waiting = await plugin.host.jobs.spawn({ task: "Look back.", kind: "retro" });
	await plugin.host.jobs.block(waiting.id, "Which port do we use?", true);
	await until("the retro blocked on the owner", () => plugin.host.jobs.list().some((job) => job.id === waiting.id && job.state === "blocked" && job.reason === "user: Which port do we use?"));
	for (const [id, project] of [["w1", "acme"], ["w2", "acme"], ["b1", "beta"]]) plugin.emit("job-started", { id, kind: "worker", project, tickets: [] });
	for (const [id, text] of [["w1", "Never pkill. It stops tests."], ["w2", "Never pkill."], ["b1", "Never pkill."]]) plugin.emit("job-steered", { id, kind: "worker", text, via: "steer" });
	const job = await plugin.host.jobs.spawn({ task: PYRAMID_TASK, kind: "pyramid" });
	writeFileSync(gate, "");
	const prompt = readFileSync(join(dirname(plugin.host.folder), "jobs", job.id, "prompt"), "utf8");
	const section = prompt.slice(prompt.indexOf("## This pyramid audit"));
	assert.ok(section.startsWith(`## This pyramid audit\n\nYou audit project acme at ${job.base}; your worktree is a detached checkout of that commit.\n\n### FAIL reviews\n\n`), section);
	const expected = [
		"### FAIL reviews\n\n- AC0001 (spec/features/AC0001-t/): review-1.md, review-10.md\n\n### Open",
		"### Open and deferred findings\n\n- AC0001 F1 (bug): Open one\n- AC0001 F3 (risk): Deferred. Where: `a.ts:1`",
		"### Repeats of acme",
		`### Blocked on the owner\n\n- ${waiting.id} (retro): Which port do we use?`,
		"### Corrections\n\nSteers and continues of the project's jobs, by first sentence, most frequent first:\n\n- 2: Never pkill.",
		"### Prose\n\nThe files agents read, the plugins' roles, procedures and criteria first:\n- roles/worker.md (3 lines)\n- .claude/rules/tests.md (2 lines)\n- AGENTS.md (3 lines)\n- docs/Styleguide.md (1 lines)\n- packages/x/CLAUDE.md (1 lines)",
		"### Checks\n\nScripts:\n- package.json test: node --test\n- package.json check: tsc\n- packages/x/package.json: not read: ",
		"CI, type and lint configs:\n- .github/workflows/ci.yml (2 lines)\n- tsconfig.json (1 lines)\n\nTests: 2 test files, 4 tests\n\n### Board\n\n",
	];
	for (const part of expected) assert.ok(section.includes(part), `${part}\n---\n${section}`);
	assert.doesNotMatch(section, /No Arthur history|README|CONTRIBUTING|AC0099|F2/);
});

test("one input alone is history, the no-history line gone: a FAIL review, a finding, a steer, a question for the owner", async (t) => {
	const gate = join(temporaryFolder(), "gate");
	t.after(() => writeFileSync(gate, ""));
	const fresh = () => load(t, {}, { steps: [{ waitFor: gate }] });
	// Ticket AC0001 on acme's board, with file `name` in its folder, committed.
	const ticket = (root: string, commit: (root: string, message: string) => string, name: string, text: string) => {
		mkdirSync(join(root, "spec/features/AC0001-t"), { recursive: true });
		writeFileSync(join(root, "spec/features/AC0001-t", name), text);
		writeFileSync(join(root, "spec/build.json"), JSON.stringify([{ id: "AC0001", title: "T", status: "merged", path: "spec/features/AC0001-t/ticket.md", updated: "2026-10-20T10:00:00Z" }]));
		commit(root, name);
	};
	const NONE = "No Arthur history";
	const one = await fresh();
	ticket(one.root, one.commit, "review-1.md", "# Review\n\n- Verdict: FAIL\n");
	const fail = await one.section();
	assert.ok(fail.includes("### FAIL reviews\n\n- AC0001 (spec/features/AC0001-t/): review-1.md\n\n") && !fail.includes(NONE), fail);
	const two = await fresh();
	ticket(two.root, two.commit, "findings.md", "## F1. Open one\n\n- Status: open\n");
	const finding = await two.section();
	assert.ok(finding.includes("### Open and deferred findings\n\n- AC0001 F1: Open one\n\n") && !finding.includes(NONE), finding);
	const three = await fresh();
	three.fake.emit("job-started", { id: "w1", kind: "worker", project: "acme", tickets: [] });
	three.fake.emit("job-steered", { id: "w1", kind: "worker", text: "Never pkill.", via: "steer" });
	const steer = await three.section();
	assert.ok(steer.includes("first:\n\n- 1: Never pkill.\n\n") && !steer.includes(NONE), steer);
	const four = await fresh();
	const asked = await four.held("acme", "Which port?", true);
	const question = await four.section();
	assert.ok(question.includes(`### Blocked on the owner\n\n- ${asked} (retro): Which port?\n\n`) && !question.includes(NONE), question);
	const five = await fresh();
	await five.held("gamma", "Which port for gamma?", true);
	await five.held("acme", "waits on AC0002", false);
	const others = await five.section();
	assert.ok(others.includes("### Blocked on the owner\n\nnone\n\n") && others.includes(NONE), `another project's question and a dependency hold are not this project's questions\n${others}`);
});

test("filed as spec/pyramid/<date>.md with its before and after page; the wake brings the procedure; the next audit's range stays", async (t) => {
	const env = await load(t);
	const { root } = env;
	const audited = env.git(root, "rev-parse", "HEAD");
	mkdirSync(join(root, "spec/quality"));
	writeFileSync(join(root, "spec/quality/2026-10-20.md"), `# Audit 2026-10-20\n\n- Job: x\n- Commit audited: ${audited}\n`);
	env.commit(root, "the audit");
	const job = env.started((await env.command(undefined)).out);
	await env.ended(job);
	assert.equal(env.jobs.file(undefined, job), "spec/pyramid/2026-10-21.md");
	assert.equal(readFileSync(join(root, "spec/pyramid/2026-10-21.md"), "utf8"), `# Pyramid 2026-10-21\n\n- Job: ${job}\n- Commit audited: ${env.read(job, "base")}\n\n## Final message\n\n${MESSAGE}`);
	assert.throws(() => env.jobs.file(undefined, job), { message: `${job} is already filed as spec/pyramid/2026-10-21.md` });
	const page = readFileSync(join(root, "spec/pyramid/2026-10-21.html"), "utf8");
	assert.match(page, /^<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Pyramid 2026-10-21<\/title><style>:root\{--ink:#0a0a0a;/);
	assert.ok(page.includes(`<header>\n<h1>Pyramid 2026-10-21</h1>\n<ul>\n<li>Job: ${job}</li>\n<li>Commit audited: `), page);
	assert.ok(page.includes("</ul>\n</header>\n<main>\n<h2>Layers</h2>\n<p>3 corrections at human review &amp; &lt;none&gt; at static analysis.</p>\n<h2>1. A type for the port</h2>\n<p>Corrections:</p>\n<ul>\n<li>AC0001 review-1.md: the port was a <code>string</code></li>\n</ul>\n"), page);
	assert.ok(page.includes('<p>Now at: <span class="tag you">human review</span></p>\n<p>Move to: <span class="tag code">codebase</span></p>\n<p>Kind: refactor</p>\n'), page);
	assert.ok(page.includes('<div class="cols">\n<div><h3>Before</h3>\n<p>port: string\n\n// &lt;any&gt;</p></div>\n<div class="after"><h3>After</h3>\n<p>port: Port</p></div>\n</div>\n<p>Dead prose: none</p>\n<h2>Dead prose</h2>\n<p>none</p>\n</main>\n</body></html>\n'), page);
	assert.doesNotMatch(page, /Final message/);
	assert.deepEqual(env.fake.collect("coordinator.wake", { id: "x", kind: "pyramid" }).filter(Boolean), [PROCEDURE]);
	// The coordinator's commit of the report, its page, one ticket and the board: no commit for the next audit.
	mkdirSync(join(root, "spec/features/AC0001-pyramid"), { recursive: true });
	writeFileSync(join(root, "spec/features/AC0001-pyramid/ticket.md"), "# AC0001 - Pyramid\n");
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([{ id: "AC0001", title: "Pyramid", status: "planning", path: "spec/features/AC0001-pyramid/ticket.md", updated: "2026-10-21T03:00:00Z" }]));
	env.commit(root, "the pyramid");
	const audit = await env.jobs.spawn({ task: AUDIT_TASK, kind: "audit" });
	assert.ok(env.read(audit.id, "prompt").includes(`### Commits since the last audit, ${audited.slice(0, 12)} (spec/quality/2026-10-20.md)\n\nnone\n\n`), env.read(audit.id, "prompt"));
});

test("a page with an After alone, a quote left open at the end, and a layer it does not know", async (t) => {
	const env = await load(t, {}, { steps: [{ message: "## 1. T\nNow at: somewhere\nAfter:\n> new\n## 2. U\nBefore:\n> old" }] });
	const job = env.started((await env.command(undefined)).out);
	await env.ended(job);
	env.jobs.file(undefined, job);
	const page = readFileSync(join(env.root, "spec/pyramid/2026-10-21.html"), "utf8");
	assert.ok(page.includes('<h2>1. T</h2>\n<p>Now at: <span class="tag ">somewhere</span></p>\n<div class="cols"><div><h3>Before</h3><p></p></div>\n<div class="after"><h3>After</h3>\n<p>new</p></div>\n</div>\n<h2>2. U</h2>\n<div class="cols">\n<div><h3>Before</h3>\n<p>old</p></div>\n</div>\n</main>'), page);
});

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { stats } from "../src/stats.ts";

// `arthur stats` and `/stats` against the fake host: the lines of `runs.jsonl` and `sessions/*.jsonl` the test writes as the
// plugin and its extension leave them, over the projects acme and other. docs/commands/stats.md.

const NOW = new Date("2026-11-13T10:00:00Z");
const OPUS = "anthropic/claude-opus-5-5";
const used = (cost: number, input = 0, output = 0, cacheRead = 0, cacheWrite = 0) => ({ messages: 1, input, output, cacheRead, cacheWrite, cost });
const run = (time: string, kind: string, project: string, tickets: readonly string[], reason: string, seconds: number, cost: number, usage: object, more: object = {}) =>
	JSON.stringify({ seq: 1, time, job: `2026-11-10-${kind}-0000000a`, kind, project, tickets, machine: "local", state: "ended", reason, seconds, cost, usage, ...more });
const turn = (time: string, seconds: number, cost: number, more: object = {}) => JSON.stringify({ time, session: "coordinator", seconds, until: 1, cost, usage: { [OPUS]: used(cost, 1, 10) }, ...more });

const RUNS = [
	run("2026-11-12T09:00:00Z", "worker", "acme", ["AC0012"], "finished", 1260, 6, { [OPUS]: used(6, 100, 2000, 1_000_000, 50_000) }),
	run("2026-11-12T11:00:00Z", "review", "acme", ["AC0012"], "finished", 120, 2, { [OPUS]: used(2, 50, 500, 200_000, 0) }),
	run("2026-11-11T08:00:00Z", "worker", "acme", ["AC0013", "AC0014"], "failed: no verdict", 600, 3, { [OPUS]: used(3, 10, 100), "ollama/qwen": used(0, 40, 4) }),
	run("2026-11-10T10:00:00Z", "audit", "other", [], "stopped", 60, 1, {}, { backfill: true }),
	run("2026-11-12T13:00:00Z", "plan", "other", ["OT0001"], "finished", 30, 0.5, { [OPUS]: used(0.5) }),
	run("2026-11-12T12:00:00Z", "worker", "acme", [], "finished", 0, 0, {}, { missing: true }),
	run("2026-11-01T10:00:00Z", "worker", "acme", ["AC0012"], "finished", 60, 100, { [OPUS]: used(100) }),
	'{"seq":9,"job":"',
	'{"time":"never","kind":"worker"}',
];
const TURNS = [turn("2026-11-12T20:00:00Z", 60, 4), turn("2026-11-12T20:00:30Z", 30, 0.5, { sub: true })];

// The plugin on a fake host whose folder holds `runs` and `turns`, the boards of acme and other as the core leaves them.
async function load(t: TestContext, runs: readonly string[] = RUNS, turns: readonly string[] = TURNS, job?: { readonly id: string; readonly project: string }) {
	const root = temporaryFolder();
	const board = (id: string, status: string, updated: string) => ({ id, title: id, status, path: `spec/features/${id}-x/ticket.md`, updated });
	mkdirSync(join(root, "acme", "spec"), { recursive: true });
	const tickets = [board("AC0012", "merged", "2026-11-12T12:00:00Z"), board("AC0013", "dropped", "2026-11-11T09:00:00Z"), board("AC0014", "in-progress", "2026-11-11T09:00:00Z"), board("AC0015", "merged", "2026-11-01T09:00:00Z")];
	writeFileSync(join(root, "acme", "spec", "build.json"), JSON.stringify(tickets));
	mkdirSync(join(root, "other", "spec"), { recursive: true });
	writeFileSync(join(root, "other", "spec", "build.json"), "not JSON");
	const fake = fakeHost({ name: "stats", timeZone: "Europe/Warsaw", now: NOW, ...(job === undefined ? {} : { job }) });
	fake.provide("projects", () => [{ name: "acme", path: join(root, "acme"), prefix: "AC" }, { name: "other", path: join(root, "other"), prefix: "OT" }]);
	if (runs.length > 0) writeFileSync(join(fake.host.folder, "runs.jsonl"), `${runs.join("\n")}\n`);
	if (turns.length > 0) {
		mkdirSync(join(fake.host.folder, "sessions"));
		writeFileSync(join(fake.host.folder, "sessions", "coordinator.jsonl"), `${turns.join("\n")}\n`);
		writeFileSync(join(fake.host.folder, "sessions", "notes.txt"), "not a session file");
	}
	await fake.setup(stats());
	const command = fake.commands.find((each) => each.name === "stats");
	// As the CLI does, `--project <name>` is taken off the words.
	const cli = async (...words: readonly string[]) => {
		const at = words.indexOf("--project");
		const [out, err] = [[] as string[], [] as string[]];
		t.mock.method(console, "log", (text: string) => out.push(text));
		t.mock.method(console, "error", (text: string) => err.push(text));
		const input = at === -1 ? { args: words, project: undefined } : { args: words.toSpliced(at, 2), project: words[at + 1] };
		const code = await Promise.try(() => command?.run(input)).finally(() => t.mock.restoreAll());
		return { code: code ?? 0, out: out.join("\n"), err: err.join("\n") };
	};
	return { fake, cli };
}

const SINCE = "since 2026-11-06 11:00 (7 days)";
const TOTAL = [`Spend ${SINCE}, every project: $17.00 at list price, 6 runs (2 failed or stopped), 1 turn, 0h35m`, "Tokens: 202 in, 2.6K out, 1.2M cache read, 50K cache write"];
const ROLES = [
	"By role:",
	"- worker: $9.00 (53%), 3 runs (1 failed or stopped)",
	"- coordinator: $4.50 (26%), 1 turn",
	"- review: $2.00 (12%), 1 run (0 failed or stopped)",
	"- audit: $1.00 (6%), 1 run (1 failed or stopped)",
	"- plan: $0.50 (3%), 1 run (0 failed or stopped)",
];
const TICKETS = ["Most expensive tickets:", "- AC0012 (merged): $8.00: worker $6.00, review $2.00", "- AC0013 (dropped): $1.50: worker $1.50", "- AC0014 (in-progress): $1.50: worker $1.50"];

test("bare: the last 7 days of every project, each section; a line not read and a record gone are counted, never priced", async (t) => {
	const { cli } = await load(t);
	assert.deepEqual((await cli()).out.split("\n"), [
		...TOTAL,
		...ROLES,
		"By project:",
		"- acme: $11.00 (65%), 4 runs (1 failed or stopped)",
		"- no project: $4.50 (26%), 1 turn",
		"- other: $1.50 (9%), 2 runs (1 failed or stopped)",
		"By model:",
		`- ${OPUS}: $16.00 (94%), 162 in, 2.6K out, 1.2M cache read, 50K cache write`,
		"- not recorded: $1.00 (6%), 0 in, 0 out, 0 cache read, 0 cache write",
		"- ollama/qwen: $0.00 (0%), free, 40 in, 4 out, 0 cache read, 0 cache write",
		"By day:",
		"- 2026-11-10: $1.00 (6%), 1 run (1 failed or stopped)",
		"- 2026-11-11: $3.00 (18%), 1 run (1 failed or stopped)",
		"- 2026-11-12: $13.00 (76%), 4 runs (0 failed or stopped), 1 turn",
		...TICKETS,
		"- OT0001 (status unknown): $0.50: plan $0.50",
		"Whether it pays:",
		`- on 1 ticket merged ${SINCE}: $8.00, $8.00 per ticket`,
		"- on dropped tickets: $1.50",
		"- on runs that failed or were stopped: $4.00 in 2 runs",
		"- on work with no ticket (the coordinator, audits): $5.50",
		"Unknown: 1 run whose record was gone, 2 lines not read",
	]);
});

test("each filter narrows every section: project, role, model, ticket; a run of several tickets gives each its share", async (t) => {
	const { cli } = await load(t);
	const first = async (...args: string[]) => (await cli(...args)).out.split("\n").slice(0, 2);
	assert.deepEqual(await first("--role", "coordinator"), [`Spend ${SINCE}, every project, role coordinator: $4.50 at list price, 1 turn, 0h01m`, "Tokens: 2 in, 20 out, 0 cache read, 0 cache write"]);
	const free = (await cli("--model", "ollama/qwen")).out.split("\n");
	assert.deepEqual(free.slice(0, 2), [`Spend ${SINCE}, every project, model ollama/qwen: $0.00 at list price, 1 run (1 failed or stopped), 0h10m`, "Tokens: 40 in, 4 out, 0 cache read, 0 cache write"]);
	assert.deepEqual(free.slice(2, 4), ["By role:", "- worker: $0.00 (0%), 1 run (1 failed or stopped)"], "no share of a total of 0");
	assert.ok((await cli("--role", "coordinator")).out.split("\n").includes("Most expensive tickets: none"));
	assert.deepEqual(await first("--model", OPUS, "--role", "worker"), [`Spend ${SINCE}, every project, role worker, model ${OPUS}: $9.00 at list price, 2 runs (1 failed or stopped), 0h31m`, "Tokens: 110 in, 2.1K out, 1M cache read, 50K cache write"]);
	assert.deepEqual(await first("--role", "tester"), [`No job run or coordinator turn ${SINCE}, every project, role tester.`, "Unknown: 0 runs whose record was gone, 2 lines not read"]);
	assert.deepEqual((await cli("--role", "plan")).out.split("\n").slice(2, 4), ["By role:", "- plan: $0.50 (100%), 1 run (0 failed or stopped)"], "a total under $1 has its shares");
	assert.deepEqual(await first("--project", "other"), [`Spend ${SINCE}, project other: $1.50 at list price, 2 runs (1 failed or stopped), 0h01m`, "Tokens: 0 in, 0 out, 0 cache read, 0 cache write"]);
	assert.deepEqual((await cli("--ticket", "AC0013")).out.split("\n"), [
		`Runs of AC0013 ${SINCE}, every project: $1.50 at list price, 1 run`,
		`- 2026-11-11 09:00 worker, ${OPUS}+ollama/qwen, ended: failed: no verdict, $1.50 (its share of $3.00, 2 tickets), 50 in, 104 out, 0 cache read, 0 cache write, 0h10m`,
	]);
	assert.deepEqual((await cli("--ticket", "OT0001", "--role", "worker")).out, `Runs of OT0001 ${SINCE}, every project, role worker: $0.00 at list price, 0 runs`);
});

test("the 5 most expensive tickets, the most expensive first", async (t) => {
	const runs = [1, 2, 3, 4, 5, 6].map((n) => run(`2026-11-12T0${n}:00:00Z`, "worker", "acme", [`AC000${n}`], "finished", 60, n, { [OPUS]: used(n) }));
	const { cli } = await load(t, runs, []);
	assert.deepEqual((await cli()).out.split("\n").filter((line) => /^- AC/.test(line)), [6, 5, 4, 3, 2].map((n) => `- AC000${n} (status unknown): $${n}.00: worker $${n}.00`));
});

test("whether it pays: a ticket merged before the span is not merged in it, none merged is $0.00 a ticket; a run stopped at a limit was stopped", async (t) => {
	const runs = [
		run("2026-11-12T09:00:00Z", "worker", "acme", ["AC0015"], "limit: budget: $2.00 spent of $2.00", 600, 2, { [OPUS]: used(2) }),
		run("2026-11-12T10:00:00Z", "review", "acme", [], "finished", 0, 0, {}, { missing: true }),
	];
	const { cli } = await load(t, runs, []);
	assert.deepEqual((await cli()).out.split("\n"), [
		`Spend ${SINCE}, every project: $2.00 at list price, 2 runs (1 failed or stopped), 0h10m`,
		"Tokens: 0 in, 0 out, 0 cache read, 0 cache write",
		"By role:",
		"- worker: $2.00 (100%), 1 run (1 failed or stopped)",
		"- review: $0.00 (0%), 1 run (0 failed or stopped)",
		"By project:",
		"- acme: $2.00 (100%), 2 runs (1 failed or stopped)",
		"By model:",
		`- ${OPUS}: $2.00 (100%), 0 in, 0 out, 0 cache read, 0 cache write`,
		"By day:",
		"- 2026-11-12: $2.00 (100%), 2 runs (1 failed or stopped)",
		"Most expensive tickets:",
		"- AC0015 (merged): $2.00: worker $2.00",
		"Whether it pays:",
		`- on 0 tickets merged ${SINCE}: $0.00, $0.00 per ticket`,
		"- on dropped tickets: $0.00",
		"- on runs that failed or were stopped: $2.00 in 1 run",
		"- on work with no ticket (the coordinator, audits): $0.00",
		"Unknown: 1 run whose record was gone, 0 lines not read",
	]);
});

test("--since: today, yesterday and a date from the local day's start in core.timeZone, <n>d from now; anything else is wrong usage", async (t) => {
	// Each at a limit, in Warsaw (UTC+1): its cost one bit, so a total names the lines it holds.
	const at = ["2026-11-12T10:00:00.000Z", "2026-11-12T09:59:59.999Z", "2026-11-11T23:00:00.000Z", "2026-11-11T22:59:59.999Z", "2026-11-12T23:00:00.000Z", "2026-11-12T22:59:59.999Z"];
	// The first an hour less a second, today's an hour: 1h59m together.
	const { cli } = await load(t, at.map((time, bit) => run(time, "worker", "acme", [], "finished", [3599, 0, 0, 0, 3600][bit] ?? 0, 2 ** bit, {})), []);
	const first = async (since: string) => (await cli("--since", since)).out.split("\n")[0];
	assert.equal(await first("today"), "Spend since 2026-11-13 (today), every project: $16.00 at list price, 1 run (0 failed or stopped), 1h00m");
	assert.equal(await first("yesterday"), "Spend since 2026-11-12 (yesterday), every project: $55.00 at list price, 5 runs (0 failed or stopped), 1h59m");
	assert.equal(await first("2026-11-12"), "Spend since 2026-11-12, every project: $55.00 at list price, 5 runs (0 failed or stopped), 1h59m");
	assert.equal(await first("1d"), "Spend since 2026-11-12 11:00 (1 day), every project: $49.00 at list price, 3 runs (0 failed or stopped), 1h59m");
	assert.equal(await first("99999d"), "Spend since 1753-01-29 11:24 (99999 days), every project: $63.00 at list price, 6 runs (0 failed or stopped), 1h59m");
	assert.equal(await first("2026-11-14"), "No job run or coordinator turn since 2026-11-14, every project.");
	const usage = { code: 2, out: "", err: "usage: arthur stats [--since today|yesterday|<n>d|YYYY-MM-DD] [--project <name>] [--role <role>] [--ticket <id>] [--model <provider/model>]" };
	for (const args of [["--since", "0d"], ["--since", "100000d"], ["--since", "07d"], ["--since", "2026-02-30"], ["--since", "2026-13-01"], ["--since", "tomorrow"], ["--since"], ["now"], ["--nope", "x"]])
		assert.deepEqual(await cli(...args), usage, args.join(" "));
});

test("an empty folder says so in one line; a folder of unread lines adds the count", async (t) => {
	assert.deepEqual(await (await load(t, [], [])).cli(), { code: 0, out: `No job run or coordinator turn ${SINCE}, every project.`, err: "" });
	assert.deepEqual((await (await load(t, ["{", "[1]", "null", "nope"], [])).cli()).out, `No job run or coordinator turn ${SINCE}, every project.\nUnknown: 0 runs whose record was gone, 4 lines not read`);
});

test("/stats answers the total, by role and the top 3 tickets, or a ticket's runs, without the model; other words are its usage", async (t) => {
	const { fake, cli } = await load(t);
	assert.equal(await fake.host.commands.route("/stats"), [...TOTAL, ...ROLES, ...TICKETS].join("\n"));
	assert.deepEqual(fake.host.commands.phone().map((entry) => entry.name), ["stats"]);
	const thirty = await fake.host.commands.route("/stats AC0012 30d");
	assert.deepEqual(thirty.split("\n"), [
		"Runs of AC0012 since 2026-10-14 12:00 (30 days), every project: $108.00 at list price, 3 runs",
		`- 2026-11-01 11:00 worker, ${OPUS}, ended: finished, $100.00, 0 in, 0 out, 0 cache read, 0 cache write, 0h01m`,
		`- 2026-11-12 10:00 worker, ${OPUS}, ended: finished, $6.00, 100 in, 2K out, 1M cache read, 50K cache write, 0h21m`,
		`- 2026-11-12 12:00 review, ${OPUS}, ended: finished, $2.00, 50 in, 500 out, 200K cache read, 0 cache write, 0h02m`,
	], "the oldest first, though the file holds the oldest last; summer time then");
	// Since yesterday: two tickets, AC0012 and OT0001.
	const full = (await cli("--since", "yesterday")).out.split("\n");
	const top = full.indexOf("Most expensive tickets:");
	assert.equal(await fake.host.commands.route("/stats  yesterday "), [...full.slice(0, full.indexOf("By project:")), ...full.slice(top, top + 3)].join("\n"));
	for (const text of ["/stats 7d 30d", "/stats nope", "/stats AC0012 AC0013", "/stats ac0012", "/stats AC012"]) assert.equal(await fake.host.commands.route(text), "usage: /stats [today|yesterday|<n>d|YYYY-MM-DD] [<ticket id>]", text);
});

test("inside a job the spend view and /stats say the home is hidden, arthur stats exiting 1; arthur stats tickets still runs", async (t) => {
	const { fake, cli } = await load(t, RUNS, TURNS, { id: "2026-11-13-worker-0000000f", project: "acme" });
	const hidden = "the spend is kept in Arthur's home, which a job cannot read; arthur stats tickets runs here";
	assert.deepEqual(await cli(), { code: 1, out: "", err: `arthur stats: ${hidden}` });
	assert.equal(await fake.host.commands.route("/stats"), hidden);
	assert.match((await cli("tickets")).out, /^Stats of acme: 2 merged tickets\n/);
});

// What the models plugin answers as `models.windows`: each window of the report with its provider, or why there is none.
const window = (provider: string, label: string, used: number, more: object = {}) => ({ provider, label, used, tier: false, ...more });
const WEEK = 604_800_000;
const WINDOWS_HEAD = "Usage windows, each beside Arthur's spend at list price on its provider's models in its span; by role, its share ≈ its part of the window, at most: the account's use outside Arthur counts too.";

test("stats windows: each window beside its provider's spend in its span by role, ≈ used × the share, ties by name; without resetsAt the span before now; no span", async (t) => {
	const runs = [
		run("2026-11-12T09:00:00Z", "worker", "acme", [], "finished", 60, 16, { [OPUS]: used(6), "openai-codex/gpt-5": used(10) }),
		run("2026-11-12T11:00:00Z", "review", "acme", [], "finished", 60, 12, { [OPUS]: used(2), "openai-codex/gpt-5": used(10) }),
		run("2026-11-12T12:00:00Z", "audit", "acme", [], "finished", 60, 1, {}, { backfill: true }),
		run("2026-11-07T09:59:59.999Z", "worker", "acme", [], "finished", 60, 100, { [OPUS]: used(100) }),
		run("2026-11-07T10:00:00.000Z", "plan", "acme", [], "finished", 60, 0.5, { [OPUS]: used(0.5) }),
	];
	const { fake, cli } = await load(t, runs);
	const day = NOW.getTime() + 86_400_000;
	fake.provide("models.windows", async () => [
		window("anthropic", "Claude 7 Day", 0.4, { resetsAt: day, durationMs: WEEK }),
		window("anthropic", "Claude 5 Hour", 0.13, { durationMs: 18_000_000 }),
		window("anthropic", "Claude 7 Day (fable)", 0.9, { resetsAt: day, tier: true }),
		window("openai-codex", "Codex 7 Day", 0.05, { resetsAt: day, durationMs: WEEK }),
	]);
	assert.deepEqual(await cli("windows"), {
		code: 0,
		out: [
			WINDOWS_HEAD,
			"- anthropic Claude 7 Day 40% used, since 2026-11-07 11:00: $13.00; worker 46% ≈ 18%, coordinator 35% ≈ 14%, review 15% ≈ 6%, plan 4% ≈ 2%",
			"- anthropic Claude 5 Hour 13% used, since 2026-11-13 06:00: $0.00",
			"- anthropic Claude 7 Day (fable) 90% used: the report gives no span",
			"- openai-codex Codex 7 Day 5% used, since 2026-11-07 11:00: $20.00; review 50% ≈ 3%, worker 50% ≈ 3%",
		].join("\n"),
		err: "",
	});
});

test("stats windows: no report, no window, no models plugin, each one line; wrong usage exits 2; inside a job exits 1", async (t) => {
	const { fake, cli } = await load(t);
	assert.deepEqual(await cli("windows"), { code: 0, out: "no usage windows: the models plugin is not loaded", err: "" });
	let answer: unknown = "the agent has no usage report (omp usage --json: network down)";
	fake.provide("models.windows", async () => answer);
	assert.equal((await cli("windows")).out, "no usage windows: the agent has no usage report (omp usage --json: network down)");
	answer = [];
	assert.equal((await cli("windows")).out, "no usage windows: no account reports one");
	assert.deepEqual(await cli("windows", "extra"), { code: 2, out: "", err: "usage: arthur stats windows" });
	const inJob = await load(t, RUNS, TURNS, { id: "2026-11-13-worker-0000000f", project: "acme" });
	inJob.fake.provide("models.windows", async () => [window("anthropic", "Claude 7 Day", 0.4, { durationMs: WEEK })]);
	assert.deepEqual(await inJob.cli("windows"), { code: 1, out: "", err: "arthur stats: the spend is kept in Arthur's home, which a job cannot read; arthur stats tickets runs here" });
});

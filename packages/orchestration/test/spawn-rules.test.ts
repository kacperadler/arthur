import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { type AgentRun, fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type OrchestrationOptions, orchestration } from "../src/orchestration.ts";

const PATH = process.env.PATH ?? "";
const LEVELS = "off, minimal, low, medium, high, xhigh, max, auto";

// The plugin set up alone on a fake host over a repository of one commit, with `omp` on `PATH` the fake agent that plays
// `steps`, then waits until the test releases it; the coordinator is not started. `PATH` is restored when the test ends.
async function load(t: TestContext, options: OrchestrationOptions, steps: AgentRun["steps"] = []) {
	// In a folder of its own, beside which the jobs' worktrees go.
	const root = join(temporaryFolder(), "acme");
	mkdirSync(root);
	const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], { cwd: root });
	git("init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "# demo\n");
	git("add", "--all");
	git("commit", "--quiet", "-m", "first");
	const gate = join(temporaryFolder(), "release");
	const agent = fakeAgent({ steps: [...steps, { waitFor: gate }] });
	process.env.PATH = `${dirname(agent)}${delimiter}${PATH}`;
	const release = () => writeFileSync(gate, "");
	t.after(() => {
		release();
		process.env.PATH = PATH;
	});
	const fake = fakeHost({ name: "orchestration", root });
	const plugin = orchestration(options);
	await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	const home = dirname(fake.host.folder);
	const records = () => (existsSync(join(home, "jobs")) ? readdirSync(join(home, "jobs")).filter((name) => !name.startsWith(".")) : []);
	// The arguments of each start of the agent, in order.
	const starts = (): string[][] => {
		const file = join(dirname(agent), "starts.jsonl");
		return existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1).map((line) => JSON.parse(line).args) : []; // whole lines only
	};
	return { jobs: fake.host.jobs, collect: fake.collect, home, release, records, starts, worktrees: join(dirname(root), ".arthur-worktrees") };
}

// The model flags among an agent's arguments, each with its value.
const modelFlags = (args: readonly string[]) => ["--model", "--thinking", "--smol"].flatMap((flag) => (args.includes(flag) ? [flag, args[args.indexOf(flag) + 1]] : []));

async function until(what: string, holds: () => boolean, ms = 15_000): Promise<void> {
	for (const deadline = Date.now() + ms; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

test("a spawn while maxAgents jobs are in a run is refused, naming them, before any record exists", async (t) => {
	const { jobs, records, release, starts } = await load(t, { maxAgents: 2 });
	const first = await jobs.spawn({ task: "One." });
	const second = await jobs.spawn({ task: "Two." });
	await until("both in their run", () => starts().length === 2);
	await assert.rejects(jobs.spawn({ task: "Three." }), {
		message: `refused by orchestration: maxAgents is 2 and 2 jobs are in a run: ${second.id}, ${first.id}; spawn again once one ends`,
	});
	assert.deepEqual(records().sort(), [first.id, second.id].sort(), "no record of the refused spawn");
	release();
	await until("both ended", () => jobs.running().length === 0);
	assert.equal((await jobs.spawn({ task: "Three." })).failed, undefined);
});

test("with maxAgents 1 a second spawn is refused, and the first job's end frees its slot at once, with no sweep", async (t) => {
	const { jobs, records, release, home } = await load(t, { maxAgents: 1 });
	const first = await jobs.spawn({ task: "One." });
	await assert.rejects(jobs.spawn({ task: "Two." }), { message: `refused by orchestration: maxAgents is 1 and 1 job is in a run: ${first.id}; spawn again once one ends` });
	release();
	await until("the first's end", () => existsSync(join(home, "jobs", first.id, "state")) && readFileSync(join(home, "jobs", first.id, "state"), "utf8") === "ended");
	const second = await jobs.spawn({ task: "Two." });
	assert.deepEqual(records().sort(), [first.id, second.id].sort());
});

test("maxAgents left out is 3: the fourth spawn is refused", async (t) => {
	const { jobs } = await load(t, {});
	const ids = [];
	for (const task of ["One.", "Two.", "Three."]) ids.unshift((await jobs.spawn({ task })).id);
	await assert.rejects(jobs.spawn({ task: "Four." }), { message: `refused by orchestration: maxAgents is 3 and 3 jobs are in a run: ${ids.join(", ")}; spawn again once one ends` });
});

test("two spawns at once with one slot left: one starts, the other is refused naming it", async (t) => {
	const { jobs, records } = await load(t, { maxAgents: 1 });
	const [one, two] = await Promise.allSettled([jobs.spawn({ task: "One." }), jobs.spawn({ task: "Two." })]);
	const started = [one, two].flatMap((each) => (each.status === "fulfilled" ? [each.value.id] : []));
	const refused = [one, two].flatMap((each) => (each.status === "rejected" ? [String(each.reason)] : []));
	assert.equal(started.length, 1);
	assert.deepEqual(refused, [`Error: refused by orchestration: maxAgents is 1 and 1 job is in a run: ${started[0]}; spawn again once one ends`]);
	assert.deepEqual(records(), started);
});

test("a thinking level omp does not know is refused before any record or worktree exists, even with a slot free", async (t) => {
	const { jobs, records, worktrees } = await load(t, { maxAgents: 1 });
	await assert.rejects(jobs.spawn({ task: "Go.", thinking: "huge" }), { message: `refused by orchestration: thinking level "huge" is not one of ${LEVELS}` });
	await assert.rejects(jobs.spawn({ task: "Go.", thinking: "" }), { message: `refused by orchestration: thinking level "" is not one of ${LEVELS}` });
	assert.deepEqual(records(), []);
	assert.equal(existsSync(worktrees), false);
	assert.equal((await jobs.spawn({ task: "Go.", thinking: "xhigh" })).thinking, "xhigh");
});

test("each role's model and thinking from roles reach the agent with the quick model; --model and --thinking win", async (t) => {
	const options: OrchestrationOptions = { maxAgents: 5, roles: { worker: { model: "anthropic/sonnet", thinking: "low" }, quick: { model: "anthropic/haiku" } } };
	const { jobs, starts } = await load(t, options);
	// One start at a time, so their order in `starts.jsonl` is the spawns'.
	for (const [index, request] of [{}, { model: "anthropic/opus" }, { model: "anthropic/opus", thinking: "max" }].entries()) {
		await jobs.spawn({ task: "Go.", ...request });
		await until(`start ${index + 1}`, () => starts().length === index + 1);
	}
	assert.deepEqual(starts().map(modelFlags), [
		["--model", "anthropic/sonnet", "--thinking", "low", "--smol", "anthropic/haiku"],
		["--model", "anthropic/opus", "--thinking", "low", "--smol", "anthropic/haiku"],
		["--model", "anthropic/opus", "--thinking", "max", "--smol", "anthropic/haiku"],
	]);
});

test("a role without a model, and no roles at all, start the agent without --model or --smol", async (t) => {
	const { jobs, starts } = await load(t, { roles: { worker: { thinking: "high" } } });
	await jobs.spawn({ task: "Go." });
	await until("the start", () => starts().length === 1);
	assert.deepEqual(modelFlags(starts()[0] ?? []), ["--thinking", "high"]);
	const bare = await load(t, {});
	await bare.jobs.spawn({ task: "Go." });
	await until("the start", () => bare.starts().length === 1);
	assert.deepEqual(modelFlags(bare.starts()[0] ?? []), []);
});

test("a role's model list goes to the core as written, which refuses it before any record without the models plugin; models.lists has each", async (t) => {
	const roles = { worker: { model: ["mac/qwen3-coder", "anthropic/haiku"] }, reviewer: { model: "anthropic/sonnet" }, planner: { thinking: "high" as const }, quick: { model: "anthropic/haiku" } };
	const { jobs, records, collect } = await load(t, { roles });
	assert.deepEqual(collect("roles.model", "worker"), [{ model: ["mac/qwen3-coder", "anthropic/haiku"], thinking: undefined, quick: "anthropic/haiku" }]);
	await assert.rejects(jobs.spawn({ task: "Go." }), { message: "a model list needs the models plugin" });
	assert.deepEqual(records(), []);
	assert.deepEqual(collect("models.lists"), [[["mac/qwen3-coder", "anthropic/haiku"], ["anthropic/sonnet"]]], "the quick model and a role without a model are no list");
});

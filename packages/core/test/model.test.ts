import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { eventBus } from "../src/events.ts";
import { jobRunner, type Prepare } from "../src/jobs.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

// Roadmap entry 82 in the core: a spawn's model as one name or an ordered list, which the plugin that provides `models.pick`
// picks from; a prepare's variables in the job's environment only. The models plugin's own tests cover its probes.

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// A repository `acme` with one commit, a home folder beside it, and the agent: the fake agent playing `run`, its environment
// written to `env` beside it at each start.
function setup(run: AgentRun = { steps: [{ message: "Done." }] }) {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first");
	const omp = fakeAgent(run);
	const agent = join(dirname(omp), "env-omp");
	writeFileSync(agent, `#!/bin/sh\nenv > '${join(dirname(omp), "env")}'\nexec '${omp}' "$@"\n`, { mode: 0o755 });
	const env = () => readFileSync(join(dirname(omp), "env"), "utf8");
	const args = () => readFileSync(join(dirname(omp), "starts.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line).args as string[]);
	return { root, home: join(folder, "home"), agent, env, args };
}

// A runner whose `collect` answers `provided[name]`, each a list of what the plugins answer.
function runner(home: string, root: string, agent: string, provided: Readonly<Record<string, readonly ((...args: never[]) => unknown)[]>> = {}) {
	const time = clock("UTC", undefined, () => new Date("2026-10-16T12:00:00Z"));
	const collect = (name: string, args: readonly unknown[]) => (provided[name] ?? []).map((fn) => (fn as (...args: readonly unknown[]) => unknown)(...args));
	return jobRunner(home, root, { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, eventBus(home), collect);
}

const read = (home: string, id: string, name: string) => readFileSync(join(home, "jobs", id, name), "utf8");
const records = (home: string) => (existsSync(join(home, "jobs")) ? readdirSync(join(home, "jobs")) : []);
async function ended(home: string, id: string): Promise<string> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) if (existsSync(join(home, "jobs", id, "state")) && read(home, id, "state") === "ended") return read(home, id, "reason");
	throw new Error(`${id} did not end`);
}
const modelOf = (args: readonly string[]) => args[args.indexOf("--model") + 1];

test("without the models plugin one model goes to the agent as it is; a list, given or a role's, is refused before any record", async () => {
	const { root, home, agent, args } = setup();
	const jobs = runner(home, root, agent);
	const job = await jobs.spawn({ task: "Go.", model: "anthropic/opus" });
	assert.equal(await ended(home, job.id), "finished");
	assert.deepEqual([read(home, job.id, "model"), read(home, job.id, "model-why"), modelOf(args()[0] ?? [])], ["anthropic/opus", "", "anthropic/opus"]);
	await assert.rejects(jobs.spawn({ task: "Go.", model: ["mac/qwen3", "anthropic/opus"] }), { message: "a model list needs the models plugin" });
	const roles = runner(home, root, agent, { "roles.model": [() => ({ model: ["mac/qwen3", "anthropic/opus"] })] });
	await assert.rejects(roles.spawn({ task: "Go." }), { message: "a model list needs the models plugin" });
	await assert.rejects(jobs.spawn({ task: "Go.", model: [] }), { message: "model must be a non-empty string or a non-empty list of them, got []" });
	assert.deepEqual(records(home), [job.id]);
});

test("models.pick answers from the list on the job's machine: the record names the model and why; a free model's job has no budget", async () => {
	const { root, home, agent, args } = setup();
	const asked: unknown[][] = [];
	const pick = (list: readonly string[], machine: string) => {
		asked.push([list, machine]);
		return Promise.resolve({ model: list[1], why: `${list[0]} unreachable: timed out after 3 s; using ${list[1]}`, free: list[1]?.startsWith("lab/") === true });
	};
	const jobs = runner(home, root, agent, { "models.pick": [pick], "roles.model": [() => ({ model: ["mac/qwen3", "anthropic/haiku"] })] });
	const job = await jobs.spawn({ task: "Go.", timeoutMinutes: 30 });
	assert.equal(await ended(home, job.id), "finished");
	assert.deepEqual(asked, [[["mac/qwen3", "anthropic/haiku"], "local"]]);
	assert.deepEqual(["model", "model-why", "budget", "timeout"].map((name) => read(home, job.id, name)), ["anthropic/haiku", "mac/qwen3 unreachable: timed out after 3 s; using anthropic/haiku", "2", "30"]);
	assert.equal(modelOf(args()[0] ?? []), "anthropic/haiku");
	const free = await jobs.spawn({ task: "Go.", model: ["mac/qwen3", "lab/qwen3"], budgetUsd: 5 });
	assert.deepEqual(["model-why", "budget", "timeout"].map((name) => read(home, free.id, name)), ["mac/qwen3 unreachable: timed out after 3 s; using lab/qwen3; budget: none, free model lab/qwen3", "0", "120"]);
	assert.equal(free.modelWhy, read(home, free.id, "model-why"));
	assert.deepEqual(asked.at(-1), [["mac/qwen3", "lab/qwen3"], "local"], "a list given on the spawn wins over the role's");
});

test("a pick that refuses, answers a model outside the list, or is provided twice refuses the spawn before any record", async () => {
	const { root, home, agent } = setup();
	const refuse = () => Promise.reject(new Error("no model available: mac/qwen3: not in its model list"));
	await assert.rejects(runner(home, root, agent, { "models.pick": [refuse] }).spawn({ task: "Go.", model: "mac/qwen3" }), { message: "no model available: mac/qwen3: not in its model list" });
	const outside = () => ({ model: "other/model", why: "using other/model", free: false });
	await assert.rejects(runner(home, root, agent, { "models.pick": [outside] }).spawn({ task: "Go.", model: "mac/qwen3" }), { message: "models.pick: expected { model, why, free }, the model one of the list" });
	const twice = { "models.pick": [outside, outside] };
	await assert.rejects(runner(home, root, agent, twice).spawn({ task: "Go.", model: "mac/qwen3" }), { message: "models.pick is provided 2 times; one plugin provides it" });
	const none = await runner(home, root, agent, { "models.pick": [outside] }).spawn({ task: "Go." });
	assert.equal(read(home, none.id, "model"), "", "no model, nothing to pick");
	assert.deepEqual(records(home), [none.id]);
});

test("a prepare's variables reach the agent's environment, never the record; ARTHUR_AGENT_MODEL is the agent's --model; a bad answer refuses", async () => {
	const { root, home, agent, env, args } = setup();
	const jobs = runner(home, root, agent);
	jobs.prepare("models", (() => ({ OLLAMA_BASE_URL: "http://127.0.0.1:11434", OLLAMA_API_KEY: "s3cr3t-key", ARTHUR_AGENT_MODEL: "ollama/qwen3" })) as Prepare);
	jobs.prepare("other", () => ({ OLLAMA_BASE_URL: "http://10.0.0.7:11434" }));
	jobs.prepare("none", () => undefined);
	const job = await jobs.spawn({ task: "Go.", model: "mac/qwen3" });
	assert.equal(await ended(home, job.id), "finished");
	assert.equal(modelOf(args()[0] ?? []), "ollama/qwen3");
	assert.match(env(), /^OLLAMA_API_KEY=s3cr3t-key$/m);
	assert.match(env(), /^OLLAMA_BASE_URL=http:\/\/10\.0\.0\.7:11434$/m, "a later prepare's variable wins");
	assert.equal(read(home, job.id, "model"), "mac/qwen3");
	const files = readdirSync(join(home, "jobs", job.id), { withFileTypes: true }).filter((entry) => entry.isFile());
	assert.deepEqual(files.filter((entry) => read(home, job.id, entry.name).includes("s3cr3t-key")).map((entry) => entry.name), []);

	for (const answer of [{ "1BAD": "s3cr3t-key" }, { GOOD: 7 }, "s3cr3t-key", ["s3cr3t-key"]]) {
		const bad = runner(home, root, agent);
		bad.prepare("models", (() => answer) as unknown as Prepare);
		const refused = await bad.spawn({ task: "Go." }).then(() => "spawned", (error: Error) => error.message);
		assert.equal(refused, "plugin models: prepare must return nothing or the job's variables, each a name of letters, digits and _ with a text; the job's worktree and record were removed");
	}
	assert.deepEqual(records(home), [job.id]);
});

test("ARTHUR_AGENT_MODEL in Arthur's own environment never reaches a job", async () => {
	const { root, home, agent, env, args } = setup();
	process.env.ARTHUR_AGENT_MODEL = "evil/model";
	try {
		const job = await runner(home, root, agent).spawn({ task: "Go.", model: "anthropic/opus" });
		assert.equal(await ended(home, job.id), "finished");
	} finally {
		delete process.env.ARTHUR_AGENT_MODEL;
	}
	assert.equal(modelOf(args()[0] ?? []), "anthropic/opus");
	assert.doesNotMatch(env(), /ARTHUR_AGENT_MODEL/);
});

test("arthur roles shows a role's list as written and asks models.pick nothing", async () => {
	const { root, home, agent } = setup();
	let picks = 0;
	const jobs = runner(home, root, agent, { "roles.model": [() => Promise.resolve({ model: ["mac/qwen3", "anthropic/opus"], thinking: "high" })], "models.pick": [() => picks++] });
	const [worker] = await jobs.roles();
	assert.deepEqual([worker?.name, worker?.model, worker?.thinking, picks], ["worker", ["mac/qwen3", "anthropic/opus"], "high", 0]);
	const wrong = runner(home, root, agent, { "roles.model": [() => ({ model: ["mac/qwen3", ""] })] });
	await assert.rejects(wrong.roles(), { message: "roles.model: the model of role worker must be a non-empty string, a non-empty list of them, or undefined" });
});

test("arthur spawn --model a,b gives the list and prints why the model was picked; arthur roles prints a role's list as written", () => {
	const { root } = setup();
	writeFileSync(
		join(root, "arthur.config.ts"),
		`export default { core: { agent: { command: "true" } }, plugins: [{ name: "orchestration", setup(host) {
	host.provide("models.pick", (list) => ({ model: list.at(-1), why: list.slice(0, -1).map((model) => model + " unreachable").concat("using " + list.at(-1)).join("; "), free: false }));
	host.provide("roles.model", () => ({ model: ["mac/qwen3", "anthropic/opus"] }));
} }] };
`,
	);
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
	const run = arthur("spawn", "Go.", "--model", "mac/qwen3,anthropic/opus");
	assert.equal(run.status, 0, run.stderr);
	assert.match(run.stderr, /^model: mac\/qwen3 unreachable; using anthropic\/opus$/m);
	assert.equal(readFileSync(join(root, ".arthur/jobs", run.stdout.trim(), "model"), "utf8"), "anthropic/opus");
	assert.match(arthur("roles").stdout, /^worker: model mac\/qwen3, anthropic\/opus, thinking the agent's default, quick model the agent's default; kinds worker; from core$/m);
});

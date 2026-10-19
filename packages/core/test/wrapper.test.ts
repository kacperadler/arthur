import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, watch, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { type JobRunner, jobRunner } from "../src/jobs.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const commit = (root: string, message: string) => git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", message);
const RECORD = ["state", "reason", "pid", "log", "result", "cost", "tool-calls", "activity", "commits"];
const EXTENSIONS = ["env-guard.ts", "worktree-guard.ts", "steer.ts"].flatMap((file) => ["-e", join(import.meta.dirname, "..", "src", file)]);

// A repository `acme`, a home folder beside it, and a runner whose agent is `agent`; the plugin `delivery` owns the
// read-only kind `review`.
function setup(agent: string): { readonly root: string; readonly home: string; readonly jobs: JobRunner } {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	commit(root, "first");
	const home = join(folder, "home");
	const time = clock("UTC", undefined, () => new Date("2026-10-16T08:00:00Z"));
	const jobs = jobRunner(home, root, { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, eventBus(home), () => []);
	writeFileSync(join(folder, "reviewer.md"), "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(join(folder, "reviewer.md")), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	return { root, home, jobs };
}

// Waits until `predicate` holds, at most 20 seconds.
async function until<T>(what: string, predicate: () => T | undefined): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

// The job's `job-ended`, once the wrapper emitted it, and the record as it is then.
async function ended(home: string, id: string): Promise<{ readonly data: unknown; readonly record: Readonly<Record<string, string>> }> {
	const event = await until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
	const record = Object.fromEntries(RECORD.map((name) => [name, readFileSync(join(home, "jobs", id, name), "utf8")]));
	return { data: event.data, record };
}

// Whole lines only: a line the agent is still appending has no line break yet.
const starts = (agent: string) =>
	readFileSync(join(dirname(agent), "starts.jsonl"), "utf8")
		.split("\n")
		.slice(0, -1)
		.map((line) => JSON.parse(line) as { readonly pid: number; readonly cwd: string; readonly args: readonly string[] });

const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

test("a finished worker: the agent gets the worker's tools, model, thinking and prompt; the record holds the run, state last", async (t) => {
	const gate = join(temporaryFolder(), "committed");
	const tests = "✔ one\nℹ tests 3\nℹ suites 0\nℹ pass 3\nℹ fail 0\n";
	const agent = fakeAgent({
		steps: [
			{ message: "Reading first.", stopReason: "toolUse", cost: 0.01 },
			{ tool: "read", args: { path: "README.md" }, output: "acme" },
			{ tool: "bash", args: { command: "npm test" }, output: tests },
			{ tool: "edit", args: { path: "README.md" }, output: "edited" },
			{ tool: "bash", args: { command: "git commit -am 'fix the README'" }, output: "" },
			{ waitFor: gate },
			{ message: "Fixed the README.\nAll tests pass.", cost: 0.02 },
		],
	});
	const { root, home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Fix the README.", model: "anthropic/opus", thinking: "high" });
	const folder = join(home, "jobs", job.id);
	const field = (name: string) => (existsSync(join(folder, name)) ? readFileSync(join(folder, name), "utf8") : undefined);
	// Every file the wrapper writes into the record, in order; a rename shows under the new name. The lock of a state change is no file of the record.
	const changes: string[] = [];
	const watcher = watch(folder, (_, name) => void (name !== null && !name.startsWith(".") && !name.startsWith("state.lock") && changes.push(name)));
	t.after(() => watcher.close());
	const current = ["tool-calls", "state", "cost", "activity"];
	const expected = ["4", "working", "0.0100", "think"];
	await until("the record kept current while it runs", () => JSON.stringify(current.map(field)) === JSON.stringify(expected));
	writeFileSync(join(job.worktree, "README.md"), "acme, fixed\n");
	git(job.worktree, "add", "--all");
	commit(job.worktree, "fix the README");
	writeFileSync(gate, "");
	const { data, record } = await ended(home, job.id);
	// The test's own file, after job-ended: once its change is seen, every change before it was.
	writeFileSync(join(folder, "seen"), "");
	await until("the test's own change", () => changes.includes("seen"));
	assert.equal(changes[changes.indexOf("seen") - 1], "state", `state written last: ${changes.join(", ")}`);
	assert.deepEqual(RECORD.filter((name) => name !== "pid" && !changes.includes(name)), [], "every file written at the end");
	const [start] = starts(agent);
	assert.ok(start);
	assert.deepEqual(start?.args, [
		...["-p", "--mode", "json", "--auto-approve", "--tools", "read,edit,write,bash,grep,glob"],
		...["--append-system-prompt", join(folder, "prompt"), ...EXTENSIONS, "--model", "anthropic/opus", "--thinking", "high", `@${join(folder, "task")}`],
	]);
	assert.equal(start?.cwd, job.worktree);
	assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	const { log, pid, ...rest } = record;
	assert.deepEqual(rest, {
		state: "ended",
		reason: "finished",
		result: "Fixed the README.\nAll tests pass.",
		cost: "0.0300",
		"tool-calls": "4",
		activity: "think",
		commits: `${git(root, "log", "--oneline", "-1", `arthur/${job.id}`)}\n`,
	});
	assert.notEqual(Number(pid), start?.pid, "pid is the wrapper's, not the agent's");
	assert.ok(Number(pid) > 0);
	// The agent's command line first, after the one line of a job without a user manager (scope.test.ts).
	assert.match(log ?? "", /^(\[arthur [^\]]+\] no systemd scope: [^\n]+\n)?\[arthur [^\]]+\] agent: \S+ -p --mode json/);
	// The worktree guard's one line, written by the agent's own process, may land anywhere among the tool lines.
	const tools = (log ?? "").replace(/\[arthur [^\]]+\] worktree guard: [^\n]*\n/, "");
	assert.match(tools, /\nread README\.md\nbash npm test\nedit README\.md\nbash git commit -am 'fix the README'\n\[arthur [^\]]+\] ended: finished\n$/);
	assert.deepEqual(readdirSync(folder).filter((name) => name.startsWith(".") || name.startsWith("state.lock")), [], "no temporary file or lock left");
});

test("a read-only kind gets no edit or write, no model flag, and no commits", async () => {
	const agent = fakeAgent({ steps: [{ message: "PASS" }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Review it.", kind: "review" });
	const { data, record } = await ended(home, job.id);
	const folder = join(home, "jobs", job.id);
	assert.deepEqual(starts(agent)[0]?.args, [
		...["-p", "--mode", "json", "--auto-approve", "--tools", "read,bash,grep,glob"],
		...["--append-system-prompt", join(folder, "prompt"), ...EXTENSIONS, `@${join(folder, "task")}`],
	]);
	assert.deepEqual(data, { id: job.id, kind: "review", project: "acme", state: "ended", reason: "finished" });
	assert.deepEqual([record.result, record.commits, record["tool-calls"], record.cost], ["PASS", "", "0", "0.0000"]);
});

// Each run, and the reason it ends `ended` with; every file of the record is there once the state is final.
const ENDINGS: readonly (readonly [string, AgentRun, string])[] = [
	["exit code", { steps: [{ message: "Done." }], exitCode: 3 }, "failed: the agent exited 3"],
	["error", { steps: [{ message: "", stopReason: "error", error: "401 authentication_error" }], exitCode: 1 }, "failed: the agent stopped on error: 401 authentication_error"],
	["aborted", { steps: [{ message: "Half.", stopReason: "aborted" }] }, "failed: the agent stopped on aborted"],
	["no final message", { steps: [{ tool: "read", args: { path: "README.md" } }] }, "failed: the agent ended without a final message"],
	["signal", { steps: [{ tool: "read", args: { path: "README.md" } }, { signal: "SIGKILL" }, { message: "never" }] }, "failed: the agent was killed by SIGKILL"],
	["crash mid-line", { steps: [{ stdout: '{"type":"message_end","message":{"role":"assist' }], exitCode: 134 }, "failed: the agent exited 134"],
	["a Blocked: line after a failure", { steps: [{ message: "Blocked: user may I?" }], exitCode: 1 }, "failed: the agent exited 1"],
];

for (const [name, run, reason] of ENDINGS)
	test(`an agent that ends on ${name}: ended, ${reason}`, async () => {
		const { home, jobs } = setup(fakeAgent(run));
		const job = await jobs.spawn({ task: "Go." });
		const { data, record } = await ended(home, job.id);
		assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason });
		assert.deepEqual([record.state, record.reason], ["ended", reason]);
		assert.ok(record.log?.endsWith(`] ended: ${reason}\n`), record.log);
		const tools = run.steps.filter((step) => "tool" in step).length;
		assert.deepEqual([record["tool-calls"], record.commits], [String(tools), ""]);
		if (name === "crash mid-line") assert.match(record.log ?? "", /\n\{"type":"message_end","message":\{"role":"assist\n/);
		if (name === "aborted") assert.equal(record.result, "Half.");
	});

test("an agent that cannot start: failed, naming why", async () => {
	const missing = join(temporaryFolder(), "omp");
	const { home, jobs } = setup(missing);
	const job = await jobs.spawn({ task: "Go." });
	const { data, record } = await ended(home, job.id);
	const reason = `the agent did not start: spawn ${missing} ENOENT`;
	assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: `failed: ${reason}` });
	assert.deepEqual([record.result, record.cost, record["tool-calls"]], ["", "0.0000", "0"]);
});

test("lines longer than a pipe buffer reach the log and the result whole", async () => {
	// `€` is three bytes, so a chunk of 64 KiB ends inside a character.
	const long = (letter: string) => `${letter}${"€".repeat(100_000)}`;
	const agent = fakeAgent({ steps: [{ stderr: long("e") }, { stdout: long("o") }, { message: long("m") }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const { data, record } = await ended(home, job.id);
	assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	assert.equal(record.result, long("m"));
	const lines = (record.log ?? "").split("\n");
	assert.ok(lines.includes(long("e")), "the stderr line whole");
	assert.ok(lines.includes(long("o")), "the stdout line that is not JSON whole");
});

test("a record deleted while the job runs: the agent is stopped, the wrapper ends with one line and writes nothing else", async () => {
	const gates = temporaryFolder();
	const agent = fakeAgent({
		steps: [{ waitFor: join(gates, "deleted") }, { message: "Still here.", stopReason: "toolUse" }, { waitFor: join(gates, "never") }],
	});
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const folder = join(home, "jobs", job.id);
	const wrapper = Number(await until("the wrapper's pid", () => (existsSync(join(folder, "pid")) ? readFileSync(join(folder, "pid"), "utf8") : undefined)));
	const [start] = await until("the agent's start", () => (existsSync(join(dirname(agent), "starts.jsonl")) ? starts(agent) : undefined));
	rmSync(folder, { recursive: true });
	writeFileSync(join(gates, "deleted"), "");
	await until("the wrapper's end", () => !alive(wrapper));
	await until("the agent's end", () => !alive(start?.pid ?? 0));
	assert.equal(existsSync(folder), false, "nothing written into the record");
	assert.deepEqual(readdirSync(join(home, "jobs")), []);
	const line = `job ${job.id}: its record ${folder} was deleted while it ran; the agent was stopped and nothing more is written`;
	assert.match(readFileSync(join(home, "wrapper.log"), "utf8"), new RegExp(`^\\[arthur [^\\]]+\\] ${line.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\n$`));
	assert.deepEqual(readEvents(home, 1).map((event) => event.name), ["job-started"]);
});

test("a record deleted while the job runs stops every process the agent started, not only the agent", async () => {
	// An agent whose bash call left a process running, as `npm test` or a server does: a child of its own.
	const dir = temporaryFolder();
	const agent = join(dir, "omp");
	const script = [
		"#!/bin/sh",
		`sleep 100 & echo $! > '${dir}/child'`,
		`while [ ! -e '${dir}/deleted' ] && [ -d '${dir}' ]; do sleep 0.02; done`,
		`echo '{"type":"turn_start"}'`,
		`while [ -d '${dir}' ]; do sleep 0.02; done`,
	];
	writeFileSync(agent, `${script.join("\n")}\n`, { mode: 0o755 });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const folder = join(home, "jobs", job.id);
	const wrapper = Number(await until("the wrapper's pid", () => (existsSync(join(folder, "pid")) ? readFileSync(join(folder, "pid"), "utf8") : undefined)));
	const child = Number(await until("the agent's child", () => (existsSync(join(dir, "child")) ? readFileSync(join(dir, "child"), "utf8").trim() || undefined : undefined)));
	assert.ok(alive(child));
	rmSync(folder, { recursive: true });
	writeFileSync(join(dir, "deleted"), "");
	await until("the wrapper's end", () => !alive(wrapper));
	await until("the end of the agent's child", () => !alive(child));
	assert.equal(existsSync(folder), false, "nothing written into the record");
});

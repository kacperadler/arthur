import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { GRACE_SECONDS } from "../src/job-stop.ts";
import { type JobRunner, jobRunner } from "../src/jobs.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder, until } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// A repository `acme`, a home folder beside it, and a runner whose agent is `agent`, with the core's limits of 120 minutes
// and $2; the plugin `delivery` owns `review` (30 minutes, $0.5) and `audit` ($1, one resume at its budget).
function setup(agent: string): { readonly root: string; readonly home: string; readonly jobs: JobRunner } {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const home = join(folder, "home");
	const time = clock("UTC", undefined, () => new Date("2026-10-16T08:00:00Z"));
	const jobs = jobRunner(home, root, join(root, "env"), { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, eventBus(home), () => []);
	writeFileSync(join(folder, "reviewer.md"), "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(join(folder, "reviewer.md")), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer", timeoutMinutes: 30, budgetUsd: 0.5 });
	jobs.registerKind("delivery", { name: "audit", readOnly: true, role: "reviewer", budgetUsd: 1, resumeOnBudget: true });
	return { root, home, jobs };
}

// Past the longest time limit `timed` sets, 24 s, and the grace of a stop after it: a wait for a job's end, or for a state the
// job's end may come first to.
const LONG = { deadlineMs: 60_000 };

const field = (home: string, id: string, name: string) => readFileSync(join(home, "jobs", id, name), "utf8");

// The job's `job-ended` event, once the wrapper emitted it; the record's `state` is final then.
const endOf = (home: string, id: string) => readEvents(home, 1).find((event) => event.name === "job-ended" && typeof event.data === "object" && event.data !== null && "id" in event.data && event.data.id === id);

async function ended(home: string, id: string): Promise<unknown> {
	return (await until("job-ended", () => endOf(home, id), LONG)).data;
}

// A time limit counts from the wrapper's start, before the sandbox's, which a busy host can push past a short limit
// (AR0565). `attempt` runs a test with a limit of 3 s, then twice as long while the limit ended its job before the state
// the test awaits, up to 24 s; it answers false when it did (`before`), true when it ran its assertions.
async function timed(attempt: (timeoutMinutes: number) => Promise<boolean>): Promise<void> {
	for (let seconds = 3; seconds <= 24; seconds *= 2) if (await attempt(seconds / 60)) return;
	assert.fail("each time limit up to 24 s ended the job before the state the test awaits");
}

// What `predicate` gives once it holds, or undefined when the job ended first, which only its time limit may have done.
async function before<T>(home: string, id: string, timeoutMinutes: number, what: string, predicate: () => T | undefined): Promise<T | undefined> {
	const seen = await until(`${what} or the job's end`, () => {
		const end = endOf(home, id); // Read first: a state that holds once the job has ended held before its end.
		const value = predicate();
		if (value !== undefined && value !== false) return { value };
		return end && { end };
	}, LONG);
	if ("value" in seen) return seen.value;
	const { reason } = seen.end.data as { readonly reason: string };
	assert.ok(reason.startsWith(`limit: time: the job ran past its timeout of ${timeoutMinutes} minutes`), `ended before ${what}: ${reason}`);
	return undefined;
}

const starts = (agent: string) =>
	readFileSync(join(agent, "..", "starts.jsonl"), "utf8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line) as { readonly args: readonly string[] });

const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

// A step the agent never gets past: only a stop ends it.
const stuck = () => ({ waitFor: join(temporaryFolder(), "never") });

test("a job's limits are the request's, else its kind's, else the core's; 0 asked for is kept, not replaced", async () => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }));
	const seen: unknown[] = [];
	jobs.beforeSpawn("orchestration", (spawn) => void seen.push([spawn.timeoutMinutes, spawn.budgetUsd]));
	const cases = [
		[{ task: "Go." }, ["120", "2", "false"]],
		[{ task: "Review.", kind: "review" }, ["30", "0.5", "false"]],
		[{ task: "Review.", kind: "review", timeoutMinutes: 0, budgetUsd: 0 }, ["0", "0", "false"]],
		[{ task: "Audit.", kind: "audit", timeoutMinutes: 5.5 }, ["5.5", "1", "true"]],
	] as const;
	for (const [request, record] of cases) {
		const job = await jobs.spawn(request);
		assert.deepEqual([job.timeoutMinutes, job.budgetUsd].map(String), record.slice(0, 2), JSON.stringify(request));
		assert.deepEqual(["timeout", "budget", "resume-on-budget"].map((name) => field(home, job.id, name)), record, JSON.stringify(request));
		await ended(home, job.id);
	}
	assert.deepEqual(seen, cases.map(([, record]) => record.slice(0, 2).map(Number)));
});

test("a limit that is not a number of 0 or more is refused: a spawn's before anything exists, a kind's at registration", async () => {
	const { root, home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }));
	for (const [limits, message] of [
		[{ budgetUsd: -0.01 }, "spawn: budgetUsd must be a number of 0 or more, got -0.01"],
		[{ timeoutMinutes: Number.NaN }, "spawn: timeoutMinutes must be a number of 0 or more, got NaN"],
		[{ timeoutMinutes: Number.POSITIVE_INFINITY }, "spawn: timeoutMinutes must be a number of 0 or more, got Infinity"],
		[{ budgetUsd: "1" as unknown as number }, 'spawn: budgetUsd must be a number of 0 or more, got "1"'],
	] as const)
		await assert.rejects(jobs.spawn({ task: "Go.", ...limits }), { message });
	assert.equal(existsSync(join(home, "jobs")), false);
	assert.equal(git(root, "worktree", "list").split("\n").length, 1);
	for (const [kind, message] of [
		[{ budgetUsd: -1 }, "kind plan: budgetUsd must be a number of 0 or more, got -1"],
		[{ timeoutMinutes: "30" as unknown as number }, 'kind plan: timeoutMinutes must be a number of 0 or more, got "30"'],
		[{ resumeOnBudget: "yes" as unknown as boolean }, "kind plan: resumeOnBudget must be true or false"],
		[{ verdicts: [] }, "kind plan: verdicts must be a non-empty list of lines, each text without line breaks or spaces around it"],
		[{ verdicts: ["PASS", " FAIL"] }, "kind plan: verdicts must be a non-empty list of lines, each text without line breaks or spaces around it"],
		[{ verdicts: "PASS" as unknown as string[] }, "kind plan: verdicts must be a non-empty list of lines, each text without line breaks or spaces around it"],
	] as const)
		assert.throws(() => jobs.registerKind("delivery", { name: "plan", readOnly: true, role: "reviewer", ...kind }), { message });
});

// Each run's costs, the budget, and the outcome it ends with: a cost exactly at the budget stops, below it does not.
const BUDGETS: readonly (readonly [string, readonly number[], number, string, string])[] = [
	["a sum floating point leaves a hair below the budget", [0.7, 0.1, 0.1, 0.1], 1, "limit: budget", "1.0000"],
	["one cent below the budget", [0.7, 0.1, 0.1, 0.09], 1, "finished", "0.9900"],
	["$0.0001 below the budget", [0.9999], 1, "finished", "0.9999"],
	["one exactly at the budget", [0.5, 0.5], 1, "limit: budget", "1.0000"],
	["a budget of 0, which is none", [5, 5], 0, "finished", "10.0000"],
];

for (const [name, costs, budgetUsd, outcome, cost] of BUDGETS)
	test(`budget: ${name}: ${outcome}`, async () => {
		// The agent ends on its own after its costs, unless the limit stopped it at the last of them.
		const run: AgentRun = { steps: [...costs.map((cost) => ({ message: "Spent.", cost, stopReason: "toolUse" as const })), { message: "Done." }] };
		const { home, jobs } = setup(fakeAgent(outcome === "finished" ? run : { steps: [...run.steps.slice(0, -1), stuck()] }));
		const job = await jobs.spawn({ task: "Go.", budgetUsd });
		const data = await ended(home, job.id);
		const reason = outcome === "finished" ? "finished" : `limit: budget: its cost $${cost} reached its budget of $${budgetUsd}`;
		assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason });
		assert.deepEqual([field(home, job.id, "reason"), field(home, job.id, "cost")], [reason, cost]);
		if (outcome !== "finished") assert.match(field(home, job.id, "log"), /\] limit: budget: stopping the agent\n/);
	});

test("a timeout during a long tool call stops the agent and the tool's process; a kind that resumes at its budget is not resumed", () =>
	timed(async (timeoutMinutes) => {
		const dir = temporaryFolder();
		const agent = join(dir, "omp");
		const start = { type: "tool_execution_start", toolCallId: "toolu_1", toolName: "bash", args: { command: "sleep 100" } };
		const script = ["#!/bin/sh", `echo started >> '${dir}/starts'`, `echo '${JSON.stringify(start)}'`, `sleep 100 & echo $! > '${dir}/tool'`, "wait"];
		writeFileSync(agent, `${script.join("\n")}\n`, { mode: 0o755 });
		const { home, jobs } = setup(agent);
		const job = await jobs.spawn({ task: "Audit.", kind: "audit", timeoutMinutes });
		const pid = await before(home, job.id, timeoutMinutes, "the tool's process", () => (existsSync(join(dir, "tool")) ? readFileSync(join(dir, "tool"), "utf8").trim() || undefined : undefined));
		if (pid === undefined) return false;
		const data = await ended(home, job.id);
		assert.deepEqual(data, { id: job.id, kind: "audit", project: "acme", state: "ended", reason: `limit: time: the job ran past its timeout of ${timeoutMinutes} minutes` });
		assert.deepEqual(["state", "activity", "tool-calls"].map((name) => field(home, job.id, name)), ["ended", "tool", "1"]);
		await until("the tool's process stopped", () => !alive(Number(pid)));
		assert.equal(readFileSync(join(dir, "starts"), "utf8"), "started\n");
		assert.match(field(home, job.id, "log"), /\] limit: time: stopping the agent\n/);
		return true;
	}));

test("a timeout during the install a prepare asked for stops it, though it ignores SIGTERM, names the install, and starts no agent", () =>
	timed(async (timeoutMinutes) => {
		const dir = temporaryFolder();
		const agent = join(dir, "omp");
		writeFileSync(agent, `#!/bin/sh\necho started >> '${dir}/starts'\n`, { mode: 0o755 });
		const { home, jobs } = setup(agent);
		jobs.prepare("projects", () => ({ ARTHUR_INSTALL: `trap '' TERM; echo $$ > '${dir}/install'; while :; do sleep 0.05; done` }));
		const job = await jobs.spawn({ task: "Go.", timeoutMinutes });
		const pid = await before(home, job.id, timeoutMinutes, "the install's process", () => (existsSync(join(dir, "install")) ? readFileSync(join(dir, "install"), "utf8").trim() || undefined : undefined));
		if (pid === undefined) return false;
		const data = await ended(home, job.id);
		assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: `limit: time: the job ran past its timeout of ${timeoutMinutes} minutes, during its install` });
		assert.equal(alive(Number(pid)), false);
		assert.equal(existsSync(join(dir, "starts")), false, "no agent started");
		assert.match(field(home, job.id, "log"), /\] limit: time: stopping the install\n/);
		return true;
	}));

test("a timeout of 0, and one longer than a Node timer can wait, never stop the job", async () => {
	for (const timeoutMinutes of [0, 50_000]) {
		const gate = join(temporaryFolder(), "go");
		const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] });
		const { home, jobs } = setup(agent);
		const job = await jobs.spawn({ task: "Go.", timeoutMinutes });
		// A timer that fires at once, as Node's does past its longest wait, has fired before the agent's start is noted.
		await until("the agent's start", () => existsSync(join(agent, "..", "starts.jsonl")));
		writeFileSync(gate, "");
		await ended(home, job.id);
		assert.equal(field(home, job.id, "reason"), "finished", `timeout ${timeoutMinutes}`);
	}
});

test("a kind that asks for it is resumed once at its budget, doubled, and stopped at the doubled one; never twice", async () => {
	const agent = fakeAgent({ steps: [{ message: "Spent.", cost: 1, stopReason: "toolUse" }, stuck()] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Audit.", kind: "audit" });
	const data = await ended(home, job.id);
	assert.deepEqual(data, { id: job.id, kind: "audit", project: "acme", state: "ended", reason: "limit: budget: its cost $2.0000 reached its budget of $2" });
	assert.deepEqual(["reason", "cost", "budget"].map((name) => field(home, job.id, name)), ["limit: budget: its cost $2.0000 reached its budget of $2", "2.0000", "2"]);
	const [first, second, ...more] = starts(agent);
	const folder = join(home, "jobs", job.id);
	const guard = ["env-guard.ts", "worktree-guard.ts", "steer.ts"].flatMap((file) => ["-e", join(import.meta.dirname, "..", "src", file)]);
	const common = ["-p", "--mode", "json", "--auto-approve", "--config", join(import.meta.dirname, "..", "src", "job-omp.yml"), "--tools", "read,bash,grep,glob", "--session-dir", join(folder, "session"), "--append-system-prompt", join(folder, "prompt"), ...guard];
	assert.deepEqual(first?.args, [...common, `@${join(folder, "task")}`]);
	assert.deepEqual(second?.args, ["--continue", ...common, "--", "Your budget of $1 ran out and was doubled to $2, once. Go on with the task where you stopped."]);
	assert.deepEqual(more, []);
	const log = field(home, job.id, "log");
	assert.equal(log.match(/\] limit: budget: \$1\.0000 reached \$1; the kind resumes once, its budget doubled to \$2\n/g)?.length, 1, log);
});

test("an agent that ignores SIGTERM at its limit gets SIGKILL after the grace; its time out while it stops at its budget, it is not resumed", () =>
	timed(async (timeoutMinutes) => {
		// An agent that ignores SIGTERM: stopped at its budget, it would go on until the test lets it end, which it never does.
		const dir = temporaryFolder();
		const agent = join(dir, "omp");
		const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 1, cacheRead: 0, cacheWrite: 0, total: 1 } };
		const content = [{ type: "text", text: "Spent." }];
		const message = { role: "assistant", content, api: "anthropic-messages", provider: "anthropic", model: "fake", usage, stopReason: "toolUse", timestamp: 0 };
		// It spends its budget 2 s before the time limit, counted like the limit from the wrapper's start (its `pid`), or at once
		// when it starts later: the time limit comes inside the grace of GRACE_SECONDS after the stop at the budget.
		const spend = [`started=$(date -r "$ARTHUR_JOB/pid" +%s%3N)`, `while [ "$(date +%s%3N)" -lt $((started + ${Math.round(timeoutMinutes * 60_000) - 2000})) ]; do sleep 0.02; done`];
		const script = ["#!/bin/sh", `echo $$ >> '${dir}/starts'`, "trap '' TERM", ...spend, `echo '${JSON.stringify({ type: "message_end", message })}'`];
		writeFileSync(agent, `${[...script, `while [ ! -e '${dir}/go' ] && [ -d '${dir}' ]; do sleep 0.02; done`].join("\n")}\n`, { mode: 0o755 });
		const { home, jobs } = setup(agent);
		const job = await jobs.spawn({ task: "Audit.", kind: "audit", timeoutMinutes });
		const log = join(home, "jobs", job.id, "log");
		// The grace counts from the wrapper's own time of the stop, which its log line gives, not from when the test saw that line.
		const line = await before(home, job.id, timeoutMinutes, "the stop at the budget", () => (existsSync(log) && /\[arthur ([^\]]+)\] limit: budget: stopping the agent\n/.exec(readFileSync(log, "utf8"))) || undefined);
		if (line === undefined) return false;
		const stopped = Date.parse(line[1] ?? "");
		await ended(home, job.id);
		const took = Date.now() - stopped;
		assert.ok(took < (GRACE_SECONDS + 5) * 1000, `ended ${took} ms after the stop`);
		assert.ok(took >= GRACE_SECONDS * 1000, `ended ${took} ms after the stop, before the grace was over`);
		assert.deepEqual(["reason", "budget"].map((name) => field(home, job.id, name)), ["limit: budget: its cost $1.0000 reached its budget of $1", "1"]);
		const text = field(home, job.id, "log");
		assert.match(text, /\] limit: time: reached as well\n/);
		assert.match(text, new RegExp(`\\] the agent's process group is still alive ${GRACE_SECONDS} seconds after SIGTERM: SIGKILL\\n`));
		const pids = readFileSync(join(dir, "starts"), "utf8").trim().split("\n");
		assert.equal(pids.length, 1, "not resumed");
		assert.equal(alive(Number(pids[0])), false);
		assert.equal(existsSync(join(dir, "go")), false);
		return true;
	}));

test("a kind that does not ask for it is not resumed at its budget", async () => {
	const agent = fakeAgent({ steps: [{ message: "Spent.", cost: 0.5, stopReason: "toolUse" }, stuck()] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Review.", kind: "review" });
	await ended(home, job.id);
	assert.equal(field(home, job.id, "reason"), "limit: budget: its cost $0.5000 reached its budget of $0.5");
	assert.deepEqual(["budget", "resume-on-budget"].map((name) => field(home, job.id, name)), ["0.5", "false"]);
	assert.equal(starts(agent).length, 1);
});

test("a resumed run that finishes ends finished, its cost the sum of both runs", async () => {
	// The first run spends the budget and waits to be stopped; the resumed one, which omp continues, finishes.
	const first = fakeAgent({ steps: [{ message: "Spent.", cost: 1, stopReason: "toolUse" }, stuck()] });
	const resumed = fakeAgent({ steps: [{ message: "Finished.", cost: 0.5 }] });
	const agent = join(temporaryFolder(), "omp");
	writeFileSync(agent, `#!/bin/sh\ncase " $* " in *" --continue "*) exec '${resumed}' "$@" ;; esac\nexec '${first}' "$@"\n`, { mode: 0o755 });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Audit.", kind: "audit" });
	assert.deepEqual(await ended(home, job.id), { id: job.id, kind: "audit", project: "acme", state: "ended", reason: "finished" });
	assert.deepEqual(["result", "cost", "budget"].map((name) => field(home, job.id, name)), ["Finished.", "1.5000", "2"]);
	assert.deepEqual([starts(first).length, starts(resumed).length], [1, 1]);
	assert.deepEqual(readdirSync(join(home, "jobs")), [job.id]);
});

// Roadmap 52 (AR0235 F1): a kind's `verdicts` judge a finished run by the last line of its final message; any other line ends it failed.
for (const [message, reason] of [
	["Clean.\n\nPASS\n", "finished"],
	["  FAIL", "finished"],
	["PASS\n\nThe branch holds.", "failed: no verdict: the last line of its final message is not PASS or FAIL alone"],
	["**PASS**", "failed: no verdict: the last line of its final message is not PASS or FAIL alone"],
] as const)
	test(`verdicts: ${JSON.stringify(message)} ends ${reason}`, async () => {
		const { home, jobs } = setup(fakeAgent({ steps: [{ message }] }));
		jobs.registerKind("delivery", { name: "judged", readOnly: true, role: "reviewer", verdicts: ["PASS", "FAIL"] });
		const job = await jobs.spawn({ task: "Judge.", kind: "judged" });
		assert.deepEqual(await ended(home, job.id), { id: job.id, kind: "judged", project: "acme", state: "ended", reason });
		assert.equal(field(home, job.id, "reason"), reason);
		assert.equal(field(home, job.id, "verdicts"), "PASS\nFAIL");
		assert.ok(jobs.list().includes(reason), `arthur jobs shows ${reason}:\n${jobs.list()}`);
		const plain = await jobs.spawn({ task: "Judge.", kind: "review" });
		assert.equal(((await ended(home, plain.id)) as { readonly reason: string }).reason, "finished", "a kind without verdicts finishes on any message");
	});

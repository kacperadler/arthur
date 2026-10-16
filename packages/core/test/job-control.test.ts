import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { steerJob, stopJob } from "../src/job-control.ts";
import { GRACE_SECONDS } from "../src/job-stop.ts";
import { type JobRunner, jobRunner } from "../src/jobs.ts";
import { queueSteer } from "../src/steer-inbox.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const CLI = join(import.meta.dirname, "..", "src", "cli.ts");

// A repository `acme`, a home folder beside it, and a runner whose agent is `agent`; the plugin `delivery` owns the read-only
// kind `review` and `audit`, which resumes once at its budget of $1.
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
	const jobs = jobRunner(home, root, { timeoutMinutes: 120, budgetUsd: 2, ...jobSlice }, agent, time, eventBus(home), () => []);
	writeFileSync(join(folder, "reviewer.md"), "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(join(folder, "reviewer.md")), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	jobs.registerKind("delivery", { name: "audit", readOnly: false, role: "reviewer", budgetUsd: 1, resumeOnBudget: true });
	return { root, home, jobs };
}

async function until<T>(what: string, predicate: () => T | undefined): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);
const field = (home: string, id: string, name: string) => read(join(home, "jobs", id, name));
// The data of each `job-ended` of job `id`, once there are `count`.
const ended = (home: string, id: string, count = 1) =>
	until(`job-ended ${count}`, () => {
		const data = readEvents(home, 1).filter((event) => event.name === "job-ended" && (event.data as { id: string }).id === id).map((event) => event.data);
		return data.length >= count ? data : undefined;
	});
const running = (home: string, id: string) => until("the job running", () => field(home, id, "state") === "running");
const starts = (agent: string) => (read(join(agent, "..", "starts.jsonl")) ?? "").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as { readonly pid: number; readonly args: readonly string[]; readonly cwd: string });
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

// An agent that is a shell script: `lines` after `#!/bin/sh`, each given the script's own folder. Returns both.
function script(lines: (dir: string) => readonly string[]): { readonly agent: string; readonly dir: string } {
	const dir = temporaryFolder();
	writeFileSync(join(dir, "omp"), `${["#!/bin/sh", ...lines(dir)].join("\n")}\n`, { mode: 0o755 });
	return { agent: join(dir, "omp"), dir };
}

// An agent that ignores SIGTERM, runs `before`, notes its pid in `<dir>/pid` and never ends on its own.
const stubborn = (before: readonly string[] = []) => script((dir) => ["trap '' TERM", ...before, `echo $$ >> '${dir}/pid'`, `while [ -d '${dir}' ]; do sleep 0.02; done`]);

// The `message_end` omp prints for an assistant message that spent `cost`, as one line of its JSON mode.
function spent(cost: number, stopReason = "toolUse"): string {
	const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: cost, cacheRead: 0, cacheWrite: 0, total: cost } };
	const message = { role: "assistant", content: [{ type: "text", text: "Spent." }], api: "anthropic-messages", provider: "anthropic", model: "fake", usage, stopReason, timestamp: 0 };
	return JSON.stringify({ type: "message_end", message });
}

test("arthur stop ends a running job stopped: SIGTERM to the agent and the processes it started, then the end, state last", async () => {
	const { agent, dir } = script((dir) => [`sleep 300 & echo $! > '${dir}/tool'`, "wait"]);
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const tool = Number(await until("the tool's process", () => read(join(dir, "tool"))?.trim() || undefined));
	await running(home, job.id);
	const started = Date.now();
	assert.equal(await stopJob(home, job.id), `${job.id}: stopped`);
	assert.ok(Date.now() - started < GRACE_SECONDS * 1000, "no grace needed: the agent ends on SIGTERM");
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "stopped", reason: "the job was stopped by arthur stop" }]);
	assert.equal(field(home, job.id, "state"), "stopped");
	assert.equal(alive(tool), false);
	assert.match(field(home, job.id, "log") ?? "", /\] arthur stop: stopping the agent\n(.*\n)?\[arthur [^\]]+\] stopped: the job was stopped by arthur stop\n$/);
	assert.doesNotMatch(field(home, job.id, "log") ?? "", /SIGKILL/);
});

// As where there is no user manager (macOS, a container): the job runs bare, so no scope kills what the stop leaves.
function bare(t: { after(fn: () => void): void }): void {
	const saved = { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS };
	t.after(() => Object.assign(process.env, saved));
	process.env.XDG_RUNTIME_DIR = temporaryFolder();
	delete process.env.DBUS_SESSION_BUS_ADDRESS;
}

test("arthur stop of an agent that ignores SIGTERM: SIGKILL to its group after the grace, and the job ends stopped", async (t) => {
	bare(t);
	const { agent, dir } = stubborn();
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const pid = Number(await until("the agent", () => read(join(dir, "pid"))?.trim() || undefined));
	await running(home, job.id);
	const started = Date.now();
	assert.equal(await stopJob(home, job.id), `${job.id}: stopped`);
	const took = Date.now() - started;
	assert.ok(took >= GRACE_SECONDS * 1000 && took < (GRACE_SECONDS + 1) * 1000, `stopped after ${took} ms`);
	await until("the agent's end", () => !alive(pid));
	assert.match(field(home, job.id, "log") ?? "", new RegExp(`\\] the agent's process group is still alive ${GRACE_SECONDS} seconds after SIGTERM: SIGKILL\\n`));
});

test("arthur stop kills a process that left the agent's group, even where no scope holds the job", async (t) => {
	bare(t);
	const folder = temporaryFolder();
	const daemon = `setsid sh -c 'echo $$ > "${folder}/daemon"; exec sleep 300' </dev/null >/dev/null 2>&1 &`;
	const { agent } = script((dir) => [daemon, `while [ ! -s '${folder}/daemon' ]; do sleep 0.02; done`, `while [ -d '${dir}' ]; do sleep 0.02; done`]);
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const pid = Number(await until("the daemon", () => read(join(folder, "daemon"))?.trim() || undefined));
	await running(home, job.id);
	assert.match(field(home, job.id, "log") ?? "", /no systemd scope/);
	assert.equal(await stopJob(home, job.id), `${job.id}: stopped`);
	await until("the daemon's end", () => !alive(pid));
	assert.match(field(home, job.id, "log") ?? "", new RegExp(`\\] SIGKILL to ${pid}, which had left the agent's process group: sleep 300\\n`));
});

test("a stop that comes while a limit stops the job leaves the limit's state, and the kind is not resumed at its budget", async () => {
	const { agent, dir } = stubborn([`echo '${spent(1)}'`]);
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Audit.", kind: "audit" });
	await until("the stop at the budget", () => field(home, job.id, "log")?.includes("] limit: budget: stopping the agent\n"));
	assert.equal(await stopJob(home, job.id), `${job.id}: ended limit: budget before the stop`);
	assert.match(field(home, job.id, "log") ?? "", /\] arthur stop: asked as well\n/);
	assert.equal(field(home, job.id, "budget"), "1");
	assert.equal(read(join(dir, "pid"))?.trim().split("\n").length, 1, "one start, no resume");
});

test("a stop that comes once the agent exited on its own leaves the job's own ending", async () => {
	// The agent exits at once; a process it left keeps its output open for a while, so the wrapper is still reading it.
	const { agent, dir } = script((dir) => [`echo '${spent(0, "stop")}'`, "sleep 2 &", `echo $$ > '${dir}/pid'`, "exit 0"]);
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const pid = Number(await until("the agent", () => read(join(dir, "pid"))?.trim() || undefined));
	await until("the agent's exit", () => !alive(pid));
	assert.equal(field(home, job.id, "state"), "running");
	process.kill(Number(field(home, job.id, "pid")), "SIGTERM");
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "done", reason: "the agent exited 0" }]);
	assert.match(field(home, job.id, "log") ?? "", /\] arthur stop: the agent had ended already\n/);
});

test("refused, each with the id and the reason: stopping or steering a job that is not running, an unknown id", async () => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	await assert.rejects(stopJob(home, job.id), { message: `${job.id} is done, not running; nothing to stop` });
	assert.throws(() => steerJob(home, job.id, "Also this."), { message: `${job.id} is done, not running; a steer reaches only a running job, and arthur continue resumes an ended worker` });
	for (const id of ["2026-10-16-worker-00000000", "../../etc", ""]) {
		await assert.rejects(stopJob(home, id), { message: `${id}: no such job in ${join(home, "jobs")}` });
		assert.throws(() => steerJob(home, id, "x"), { message: `${id}: no such job in ${join(home, "jobs")}` });
	}
	assert.throws(() => steerJob(home, job.id, "  "), { message: "the text is empty" });
	assert.deepEqual(readdirSync(join(home, "jobs", job.id, "steer")), ["closed"], "nothing queued");
});

test("a stop of a job whose wrapper is gone sends no signal and says so", async () => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	// As after a crash of the wrapper: the record says running, and its pid is now another process's, this test's.
	writeFileSync(join(home, "jobs", job.id, "state"), "running");
	writeFileSync(join(home, "jobs", job.id, "pid"), String(process.pid));
	await assert.rejects(stopJob(home, job.id), { message: `${job.id}: its wrapper ${process.pid} is gone though its state says running; nothing to stop` });
});

test("two steers before the next tool call both reach the agent after it, in order, and are moved to done", async () => {
	const gates = temporaryFolder();
	const agent = fakeAgent({ steps: [{ waitFor: join(gates, "one") }, { tool: "read", args: { path: "README.md" } }, { waitFor: join(gates, "two") }, { message: "Done." }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await running(home, job.id);
	await until("the agent's start", () => starts(agent).length === 1);
	assert.equal(steerJob(home, job.id, "Use the second file.\nIt is newer."), "0001");
	assert.equal(steerJob(home, job.id, "  And keep the tests.  "), "0002");
	const messages = join(agent, "..", "messages.jsonl");
	assert.equal(existsSync(messages), false, "nothing before the next tool call");
	writeFileSync(join(gates, "one"), "");
	await until("both steers", () => field(home, job.id, "log")?.includes("] steered 0002: "));
	const sent = read(messages)?.trim().split("\n").map((line) => JSON.parse(line));
	assert.deepEqual(sent, [
		{ content: "Use the second file.\nIt is newer.", options: { deliverAs: "steer" } },
		{ content: "And keep the tests.", options: { deliverAs: "steer" } },
	]);
	const steer = join(home, "jobs", job.id, "steer");
	assert.deepEqual([readdirSync(join(steer, "inbox")), readdirSync(join(steer, "done"))], [[], ["0001", "0002"]]);
	// The extension's lines, in order; the wrapper's line of the tool call may come between them.
	assert.match(field(home, job.id, "log") ?? "", /\] steered 0001: Use the second file\.\n(.*\n)*\[arthur [^\]]+\] steered 0002: And keep the tests\.\n/);
	writeFileSync(join(gates, "two"), "");
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "done", reason: "the agent exited 0" }]);
	assert.equal(read(messages)?.trim().split("\n").length, 2, "each steer once");
});

test("a steer still undelivered when the job ends is moved aside, logged, and named in job-ended", async () => {
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await running(home, job.id);
	assert.equal(steerJob(home, job.id, "Too late."), "0001");
	writeFileSync(gate, "");
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "done", reason: "the agent exited 0", undelivered: ["0001"] }]);
	const steer = join(home, "jobs", job.id, "steer");
	assert.deepEqual([readdirSync(join(steer, "inbox")), readdirSync(join(steer, "undelivered"))], [[], ["0001"]]);
	assert.equal(readFileSync(join(steer, "undelivered", "0001"), "utf8"), "Too late.\n");
	assert.match(field(home, job.id, "log") ?? "", /\] undelivered steer 0001: Too late\.\n/);
});

test("a steer written after the end listed the inbox moves itself aside and is refused, naming it; numbers go on", () => {
	const steer = join(temporaryFolder(), "steer");
	assert.equal(queueSteer(steer, "4242", "First."), "0001");
	writeFileSync(join(steer, "closed"), "4242");
	assert.throws(() => queueSteer(steer, "4242", "Second."), { message: "the job ended before its next tool call; steer 0002 was not delivered" });
	assert.deepEqual([readdirSync(join(steer, "inbox")), readdirSync(join(steer, "undelivered"))], [["0001"], ["0002"]]);
	// A new run, as after `arthur continue`, has another wrapper pid.
	assert.equal(queueSteer(steer, "4343", "Third."), "0003");
});

// An agent that plays `first`, and `resumed` when it is started with `--continue`.
function resuming(first: AgentRun, resumed: AgentRun): { readonly agent: string; readonly first: string; readonly resumed: string } {
	const [one, two] = [fakeAgent(first), fakeAgent(resumed)];
	const agent = join(temporaryFolder(), "omp");
	writeFileSync(agent, `#!/bin/sh\ncase " $* " in *" --continue "*) exec '${two}' "$@" ;; esac\nexec '${one}' "$@"\n`, { mode: 0o755 });
	return { agent, first: one, resumed: two };
}

test("arthur continue resumes an ended worker in place: same id, branch, worktree and session; --budget replaces the budget", async () => {
	const { agent, first, resumed } = resuming({ steps: [{ message: "First.", cost: 2 }] }, { steps: [{ tool: "read", args: { path: "README.md" } }, { message: "Second.", cost: 0.5 }] });
	const { root, home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	await jobs.continue(job.id, "  Also fix the README.\nThen commit.  ", 3);
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual(second, { id: job.id, kind: "worker", project: "acme", state: "done", reason: "the agent exited 0" });
	const folder = join(home, "jobs", job.id);
	assert.deepEqual(["state", "result", "cost", "budget", "tool-calls", "continue"].map((name) => field(home, job.id, name)), ["done", "Second.", "2.5000", "3", "1", "Also fix the README.\nThen commit."]);
	const [start] = starts(resumed);
	const extensions = ["env-guard.ts", "steer.ts"].flatMap((name) => ["-e", join(import.meta.dirname, "..", "src", name)]);
	assert.deepEqual(start?.args, ["--continue", "-p", "--mode", "json", "--auto-approve", "--tools", "read,edit,write,bash,grep,glob", "--append-system-prompt", join(folder, "prompt"), ...extensions, "Also fix the README.\nThen commit."]);
	assert.equal(start?.cwd, job.worktree);
	assert.deepEqual([starts(first).length, starts(resumed).length], [1, 1]);
	assert.equal(git(root, "branch", "--list", "--format=%(refname:short)", `arthur/${job.id}`), `arthur/${job.id}`);
	assert.deepEqual(readdirSync(join(home, "jobs")), [job.id]);
	assert.match(field(home, job.id, "log") ?? "", /\] arthur continue: Also fix the README\.\n/);
});

test("a continued job without a higher budget is stopped at once at the budget its cost already reached", async () => {
	const { agent } = resuming({ steps: [{ message: "Spent.", cost: 2, stopReason: "toolUse" }, stuck()] }, { steps: [{ message: "More.", cost: 0.01, stopReason: "toolUse" }, stuck()] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	await jobs.continue(job.id, "Go on.");
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual(second, { id: job.id, kind: "worker", project: "acme", state: "limit: budget", reason: "its cost $2.0100 reached its budget of $2" });
});

test("continue is refused, with the id and the reason: a running job, a read-only kind, an unknown id, an empty instruction, a bad budget", async () => {
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await running(home, job.id);
	await assert.rejects(jobs.continue(job.id, "More."), { message: `${job.id} is running; a running job is not continued, arthur steer gives it a correction` });
	writeFileSync(gate, "");
	await ended(home, job.id);
	const review = await jobs.spawn({ task: "Review.", kind: "review" });
	await ended(home, review.id);
	await assert.rejects(jobs.continue(review.id, "More."), { message: `${review.id} is a review, a read-only kind without a branch of its own; only a job with a branch is continued` });
	await assert.rejects(jobs.continue("2026-10-16-worker-00000000", "More."), { message: `2026-10-16-worker-00000000: no such job in ${join(home, "jobs")}` });
	await assert.rejects(jobs.continue(job.id, " \n"), { message: "the instruction is empty" });
	await assert.rejects(jobs.continue(job.id, "More.", -1), { message: "continue: budgetUsd must be a number of 0 or more, got -1" });
	assert.equal(field(home, job.id, "continue"), undefined, "nothing written");
	assert.equal(field(home, job.id, "budget"), "2");
});

test("the arthur binary stops, steers and continues a job by its id; wrong usage exits 2, a refusal 1", async () => {
	const root = join(temporaryFolder(), "acme");
	mkdirSync(root);
	writeFileSync(join(root, ".gitignore"), ".arthur/\n");
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const agent = fakeAgent({ steps: [stuck()] });
	writeFileSync(join(root, "arthur.config.ts"), `export default { core: { timeZone: "UTC", agent: { command: ${JSON.stringify(agent)} } }, plugins: [{ name: "orchestration", setup() {} }] };\n`);
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
	const home = join(root, ".arthur");
	const id = arthur("spawn", "Go.").stdout.trim();
	await running(home, id);
	assert.deepEqual([arthur("steer", id, "Mind the tests.").stdout, arthur("stop", id).stdout], [`${id}: steer 0001 queued for after its next tool call\n`, `${id}: stopped\n`]);
	assert.deepEqual(await ended(home, id), [{ id, kind: "worker", project: "acme", state: "stopped", reason: "the job was stopped by arthur stop", undelivered: ["0001"] }]);
	assert.equal(arthur("continue", id, "Go on.", "--budget", "0.5").stdout, `${id}: continued\n`);
	await running(home, id);
	const [, second] = await until("the agent's second start", () => (starts(agent).length === 2 ? starts(agent) : undefined));
	assert.deepEqual([field(home, id, "budget"), second?.args.slice(0, 1), second?.args.at(-1)], ["0.5", ["--continue"], "Go on."]);
	assert.equal(arthur("stop", id).stdout, `${id}: stopped\n`);
	const usage = { stop: "usage: arthur stop <id>", steer: "usage: arthur steer <id> <text>", continue: "usage: arthur continue <id> <instruction> [--budget <usd>]" };
	for (const [args, problem] of [
		[["stop"], "expected the id, got 0 arguments"],
		[["stop", id, "--force"], "unknown flag --force"],
		[["steer", id], "expected the id and one quoted text, got 1 arguments"],
		[["steer", id, "a", "b"], "expected the id and one quoted text, got 3 arguments"],
		[["steer", id, "a", "--budget", "1"], "unknown flag --budget"],
		[["continue", id, "x", "--budget", "1e3"], "--budget needs a number of 0 or more, got 1e3"],
		[["continue", id, "x", "--budget"], "--budget needs a number of 0 or more, got nothing"],
		[["continue", id, "x", "--budget", "1", "--budget", "2"], "--budget given twice"],
	] as const) {
		const run = arthur(...args);
		assert.deepEqual([run.status, run.stderr], [2, `arthur ${args[0]}: ${problem}\n${usage[args[0]]}\n`], args.join(" "));
	}
	const refused = arthur("stop", id);
	assert.deepEqual([refused.status, refused.stderr], [1, `arthur stop: ${id} is stopped, not running; nothing to stop\n`]);
	writeFileSync(join(root, "arthur.config.ts"), "export default { plugins: [] };\n");
	const unloaded = arthur("steer", id, "x");
	assert.equal(unloaded.status, 1);
	assert.match(unloaded.stderr, /^arthur steer: the job records are in the configured home folder, and arthur\.config\.ts did not load:\n/);
});

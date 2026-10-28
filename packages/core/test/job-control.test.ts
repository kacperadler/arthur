import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs, { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { delimiter, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { board } from "../src/board.ts";
import { moveStartedTickets, refuseUnstartableTickets } from "../src/board-jobs.ts";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { type Bus, eventBus } from "../src/events.ts";
import { steerJob, stopJob } from "../src/job-control.ts";
import { GRACE_SECONDS } from "../src/job-stop.ts";
import { type JobRunner, jobRunner } from "../src/jobs.ts";
import steerExtension from "../src/steer.ts";
import { queueSteer } from "../src/steer-inbox.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const CLI = join(import.meta.dirname, "..", "src", "cli.ts");

// A repository `acme`, a home folder beside it, and a runner whose agent is `agent`; the plugin `delivery` owns the read-only
// kind `review` and `audit`, which resumes once at its budget of $1.
function setup(agent: string): { readonly root: string; readonly home: string; readonly jobs: JobRunner; readonly bus: Bus } {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const home = join(folder, "home");
	const time = clock("UTC", undefined, () => new Date("2026-10-16T08:00:00Z"));
	const bus = eventBus(home);
	const jobs = jobRunner(home, root, join(root, "env"), { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, bus, () => []);
	writeFileSync(join(folder, "reviewer.md"), "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(join(folder, "reviewer.md")), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	jobs.registerKind("delivery", { name: "audit", readOnly: false, role: "reviewer", budgetUsd: 1, resumeOnBudget: true });
	return { root, home, jobs, bus };
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
// Every file and folder of job `id`'s record, with each file's text.
const record = (home: string, id: string) =>
	readdirSync(join(home, "jobs", id), { recursive: true, withFileTypes: true }).map((entry) => [join(entry.parentPath, entry.name), entry.isDirectory() ? "folder" : read(join(entry.parentPath, entry.name))]).sort();
// The data of each `job-ended` of job `id`, once there are `count`.
const ended = (home: string, id: string, count = 1) =>
	until(`job-ended ${count}`, () => {
		const data = readEvents(home, 1).filter((event) => event.name === "job-ended" && (event.data as { id: string }).id === id).map((event) => event.data);
		return data.length >= count ? data : undefined;
	});
const running = (home: string, id: string) => until("the job working", () => field(home, id, "state") === "working");
// Whole lines only: a line the agent is still appending has no line break yet.
const starts = (agent: string) => (read(join(agent, "..", "starts.jsonl")) ?? "").split("\n").slice(0, -1).map((line) => JSON.parse(line) as { readonly pid: number; readonly args: readonly string[]; readonly cwd: string });
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
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "stopped" }]);
	assert.deepEqual([field(home, job.id, "state"), field(home, job.id, "reason")], ["ended", "stopped"]);
	assert.equal(alive(tool), false);
	assert.match(field(home, job.id, "log") ?? "", /\] arthur stop: stopping the agent\n(.*\n)?\[arthur [^\]]+\] ended: stopped\n$/);
	assert.doesNotMatch(field(home, job.id, "log") ?? "", /SIGKILL/);
});

test("arthur stop during the install a prepare asked for ends the job stopped: the install is stopped and no agent starts, though it exits 0", async () => {
	const { agent, dir } = script((dir) => [`touch '${dir}/started'`]);
	const { home, jobs } = setup(agent);
	jobs.prepare("projects", () => ({ ARTHUR_INSTALL: `trap 'exit 0' TERM; echo $$ > '${dir}/install'; while :; do sleep 0.05; done` }));
	const job = await jobs.spawn({ task: "Go." });
	const install = Number(await until("the install's process", () => read(join(dir, "install"))?.trim() || undefined));
	assert.equal(await stopJob(home, job.id), `${job.id}: stopped`);
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "stopped" }]);
	assert.equal(alive(install), false);
	assert.equal(existsSync(join(dir, "started")), false, "no agent started");
	assert.doesNotMatch(field(home, job.id, "log") ?? "", /\] agent: /);
});

test("arthur stop once the install exited, while a process it forked still holds its output, ends the job stopped and starts no agent", async () => {
	const { agent, dir } = script((dir) => [`touch '${dir}/started'`]);
	const { home, jobs } = setup(agent);
	// The forked sleep keeps the install's stdout open after the install's own process exited; it outlives the bounded wait below,
	// so only the stop ends it there.
	jobs.prepare("projects", () => ({ ARTHUR_INSTALL: `sleep 300 & echo $! > '${dir}/forked'; echo $$ > '${dir}/install'` }));
	const job = await jobs.spawn({ task: "Go." });
	const install = Number(await until("the install's process", () => read(join(dir, "install"))?.trim() || undefined));
	await until("the install's exit", () => !alive(install));
	const forked = Number(read(join(dir, "forked"))?.trim());
	assert.ok(alive(forked), "its forked process still holds the pipe");
	assert.equal(await stopJob(home, job.id), `${job.id}: stopped`);
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "stopped" }]);
	assert.equal(existsSync(join(dir, "started")), false, "no agent started");
	assert.doesNotMatch(field(home, job.id, "log") ?? "", /\] agent: |had ended already/);
	// The stop's SIGTERM reached it, but the job may end before whatever reaps the orphan has: `alive` sees a zombie too.
	await until("the end of what the install left", () => !alive(forked));
});

// Whether this host has a systemd user manager; where it has none (a container, a shell without a session), a test of the
// job's scope itself is skipped.
const manager = spawnSync("systemctl", ["--user", "show-environment"]).status === 0;

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
	// Below the GRACE_SECONDS + 10 after which arthur stop gives up, with room for a slow runner.
	assert.ok(took >= GRACE_SECONDS * 1000 && took < (GRACE_SECONDS + 5) * 1000, `stopped after ${took} ms`);
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
	assert.equal(await stopJob(home, job.id), `${job.id}: ended (limit: budget: its cost $1.0000 reached its budget of $1) before the stop`);
	assert.match(field(home, job.id, "log") ?? "", /\] arthur stop: asked as well\n/);
	assert.equal(field(home, job.id, "budget"), "1");
	assert.equal(read(join(dir, "pid"))?.trim().split("\n").length, 1, "one start, no resume");
});

test("a stop that comes once the agent exited on its own leaves the job's own ending", async () => {
	// The agent exits at once; a process it left keeps its output open, so the wrapper is still reading it for a while.
	const { agent, dir } = script((dir) => [`echo '${spent(0, "stop")}'`, "sleep 300 &", `echo $$ > '${dir}/pid'`, "exit 0"]);
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const pid = Number(await until("the agent", () => read(join(dir, "pid"))?.trim() || undefined));
	await until("the agent's exit", () => !alive(pid));
	assert.equal(field(home, job.id, "state"), "working");
	process.kill(Number(field(home, job.id, "pid")), "SIGTERM");
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }]);
	assert.match(field(home, job.id, "log") ?? "", /\] arthur stop: the agent had ended already\n/);
});

for (const scoped of [true, false])
	test(`a process the agent left holding its output open delays the job's end by the grace only; ${scoped ? "its scope kills it" : "bare, it runs on"}`, { skip: scoped && !manager && "no systemd user manager" }, async (t) => {
		if (!scoped) bare(t);
		const { agent, dir } = script((dir) => [`echo '${spent(0, "stop")}'`, `sleep 300 & echo $! > '${dir}/holder'`, `echo $$ > '${dir}/pid'`, "exit 0"]);
		const { home, jobs } = setup(agent);
		const job = await jobs.spawn({ task: "Go." });
		const pid = Number(await until("the agent", () => read(join(dir, "pid"))?.trim() || undefined));
		const holder = Number(read(join(dir, "holder")));
		t.after(() => void (alive(holder) && process.kill(holder, "SIGKILL")));
		await until("the agent's exit", () => !alive(pid));
		const exited = Date.now();
		assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }]);
		// The wrapper waits 2 s for the pipes, not the holder's 300 s; the ceiling has room for a slow runner.
		assert.ok(Date.now() - exited < 10_000, `ended ${Date.now() - exited} ms after the agent exited`);
		assert.equal(field(home, job.id, "state"), "ended");
		if (scoped) await until("the holder's end", () => !alive(holder));
		else assert.equal(alive(holder), true, "what a bare job leaves behind is not killed at its end, as its log says");
	});

test("refused, each with the id and the reason: stopping or steering a job not in a run, an unknown id", async () => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	await assert.rejects(stopJob(home, job.id), { message: `${job.id} is ended (finished), not in a run; nothing to stop` });
	assert.throws(() => steerJob(home, job.id, "Also this."), { message: `${job.id} is ended (finished), not in a run; a steer reaches only a job in a run, and arthur continue resumes an ended or blocked worker` });
	// A run that ended blocked is not in a run either.
	writeFileSync(join(home, "jobs", job.id, "state"), "blocked");
	writeFileSync(join(home, "jobs", job.id, "reason"), "user: may I?");
	await assert.rejects(stopJob(home, job.id), { message: `${job.id} is blocked (user: may I?), not in a run; nothing to stop` });
	assert.throws(() => steerJob(home, job.id, "Also this."), { message: /^\S+ is blocked \(user: may I\?\), not in a run; a steer/ });
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
	// As after a crash of the wrapper: the record says working, and its pid is now another process's, this test's.
	writeFileSync(join(home, "jobs", job.id, "state"), "working");
	writeFileSync(join(home, "jobs", job.id, "pid"), String(process.pid));
	await assert.rejects(stopJob(home, job.id), { message: `${job.id}: its wrapper ${process.pid} is gone though its state says working; nothing to stop` });
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
		{ content: "Use the second file.\nIt is newer.", options: { deliverAs: "steer" }, step: 1 },
		{ content: "And keep the tests.", options: { deliverAs: "steer" }, step: 1 },
	]);
	const steer = join(home, "jobs", job.id, "steer");
	assert.deepEqual([readdirSync(join(steer, "inbox")), readdirSync(join(steer, "done"))], [[], ["0001", "0002"]]);
	// The extension's lines, in order; the wrapper's line of the tool call may come between them.
	assert.match(field(home, job.id, "log") ?? "", /\] steered 0001: Use the second file\.\n(.*\n)*\[arthur [^\]]+\] steered 0002: And keep the tests\.\n/);
	writeFileSync(join(gates, "two"), "");
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }]);
	assert.equal(read(messages)?.trim().split("\n").length, 2, "each steer once");
});

test("a steer delivered after the record's log is gone, as while a rm -r empties it, never creates the log; another error is thrown", (t) => {
	const record = temporaryFolder();
	mkdirSync(join(record, "steer", "inbox"), { recursive: true });
	writeFileSync(join(record, "steer", "inbox", "0001"), "Use the second file.\n");
	t.after(() => delete process.env.ARTHUR_JOB);
	process.env.ARTHUR_JOB = record;
	const sent: string[] = [];
	let handler = () => {};
	steerExtension({ on: (_, registered) => (handler = registered), sendUserMessage: (text) => sent.push(text) });
	handler();
	assert.deepEqual([sent, readdirSync(join(record, "steer", "done")), existsSync(join(record, "log"))], [["Use the second file."], ["0001"], false]);
	mkdirSync(join(record, "log"));
	writeFileSync(join(record, "steer", "inbox", "0002"), "And keep the tests.\n");
	assert.throws(handler, { code: "EISDIR" });
});

test("a steer still undelivered when the job ends is moved aside, logged, and named in job-ended", async () => {
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await running(home, job.id);
	assert.equal(steerJob(home, job.id, "Too late."), "0001");
	writeFileSync(gate, "");
	assert.deepEqual(await ended(home, job.id), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished", undelivered: ["0001"] }]);
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
	// A record an Arthur before the quick model wrote has no `quick`.
	rmSync(join(home, "jobs", job.id, "quick"));
	await jobs.continue(job.id, "  Also fix the README.\nThen commit.  ", 3);
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual(second, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	const folder = join(home, "jobs", job.id);
	assert.deepEqual(["state", "reason", "result", "cost", "budget", "tool-calls", "continue"].map((name) => field(home, job.id, name)), ["ended", "finished", "Second.", "2.5000", "3", "1", "Also fix the README.\nThen commit."]);
	const [start] = starts(resumed);
	const extensions = ["env-guard.ts", "worktree-guard.ts", "steer.ts"].flatMap((name) => ["-e", join(import.meta.dirname, "..", "src", name)]);
	assert.deepEqual(start?.args, ["--continue", "-p", "--mode", "json", "--auto-approve", "--tools", "read,edit,write,bash,grep,glob", "--append-system-prompt", join(folder, "prompt"), ...extensions, "--", "Also fix the README.\nThen commit."]);
	assert.equal(start?.cwd, job.worktree);
	assert.deepEqual([starts(first).length, starts(resumed).length], [1, 1]);
	assert.equal(git(root, "branch", "--list", "--format=%(refname:short)", `arthur/${job.id}`), `arthur/${job.id}`);
	assert.deepEqual(readdirSync(join(home, "jobs")), [job.id]);
	assert.match(field(home, job.id, "log") ?? "", /\] arthur continue: Also fix the README\.\n/);
});

// AR0487: omp takes `--version`, `--tools=...` or `@<file>` before `--` as its own option or a file to include.
test("an instruction that starts with - or @ reaches the resumed agent as its message, after --", async () => {
	const { agent, resumed } = resuming({ steps: [{ message: "First." }] }, { steps: [{ message: "Second." }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	for (const [count, instruction, message] of [[2, "--version", "--version"], [3, "@/etc/passwd", "\u2060@/etc/passwd"]] as const) {
		await jobs.continue(job.id, instruction);
		await ended(home, job.id, count);
		assert.deepEqual(starts(resumed).at(-1)?.args.slice(-2), ["--", message]);
	}
});

test("a continued job without a higher budget is stopped at once at the budget its cost already reached", async () => {
	const { agent } = resuming({ steps: [{ message: "Spent.", cost: 2, stopReason: "toolUse" }, stuck()] }, { steps: [{ message: "More.", cost: 0.01, stopReason: "toolUse" }, stuck()] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	await jobs.continue(job.id, "Go on.");
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual(second, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "limit: budget: its cost $2.0100 reached its budget of $2" });
});

test("a continue whose wrapper does not start ends the job failed and says why, not continued", async (t) => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	// A `systemctl` that sets any slice and a `systemd-run` that refuses the scope, first on PATH.
	const bin = temporaryFolder();
	writeFileSync(join(bin, "systemctl"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	writeFileSync(join(bin, "systemd-run"), "#!/bin/sh\necho 'Failed to start transient scope unit: Access denied' >&2\nexit 1\n", { mode: 0o755 });
	const saved = process.env.PATH;
	t.after(() => void (process.env.PATH = saved));
	process.env.PATH = [bin, saved].join(delimiter);
	const reason = "systemd-run: Failed to start transient scope unit: Access denied";
	assert.equal(await jobs.continue(job.id, "Go on."), reason);
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual(second, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: `failed: ${reason}` });
	assert.deepEqual(["state", "reason", "pid"].map((name) => field(home, job.id, name)), ["ended", `failed: ${reason}`, undefined]);
	assert.equal(existsSync(join(home, "jobs", job.id, "continuing")), false, "a failed continue frees the record");
});

test("a continue moves the job to working before its wrapper starts, so a continue that takes its lock over is refused", { timeout: 30_000 }, async (t) => {
	const gate = join(temporaryFolder(), "gate");
	const { agent } = resuming({ steps: [{ message: "First." }] }, { steps: [{ waitFor: gate }, { message: "Second." }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	// A `systemd-run` that writes the wrapper's `pid` (its own, which the wrapper keeps through `exec`) a second before the
	// wrapper starts: `launch` returns at the `pid`, before the new wrapper ran at all.
	const bin = temporaryFolder();
	const pid = join(home, "jobs", job.id, "pid");
	writeFileSync(join(bin, "systemctl"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	writeFileSync(join(bin, "systemd-run"), `#!/bin/sh\nwhile [ "$1" != -- ]; do shift; done\nshift\nprintf %s $$ > '${pid}.early'\nmv '${pid}.early' '${pid}'\nsleep 1\nexec "$@"\n`, { mode: 0o755 });
	const saved = process.env.PATH;
	t.after(() => void (process.env.PATH = saved));
	process.env.PATH = [bin, saved].join(delimiter);
	assert.equal(await jobs.continue(job.id, "Two."), undefined);
	assert.deepEqual(["state", "reason"].map((name) => field(home, job.id, name)), ["working", ""]);
	// As once this process ended: its `continuing` is taken over, and the state refuses.
	rmSync(join(home, "jobs", job.id, "continuing"), { force: true });
	await assert.rejects(jobs.continue(job.id, "Three."), { message: `${job.id} is working, in a run; a job in a run is not continued, arthur steer gives it a correction` });
	writeFileSync(gate, "");
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual(second, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
});

test("a continue refused while the job's new wrapper starts says why, though the wrapper removed its `continuing` meanwhile", { timeout: 30_000 }, async (t) => {
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	// A `systemd-run` that writes the wrapper's `pid` (its own, kept through `exec`), so `spawn` returns, and execs the wrapper
	// only once `start` is there: its arguments after `--` are `sh -c <exec> <log> node wrapper.ts <home> <id> <agent>`.
	const bin = temporaryFolder();
	const start = join(bin, "start");
	writeFileSync(join(bin, "systemctl"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	writeFileSync(join(bin, "systemd-run"), `#!/bin/sh\nwhile [ "$1" != -- ]; do shift; done\nshift\npid="$7/jobs/$8/pid"\nprintf %s $$ > "$pid.early"\nmv "$pid.early" "$pid"\nwhile [ ! -e '${start}' ]; do sleep 0.05; done\nexec "$@"\n`, { mode: 0o755 });
	const saved = process.env.PATH;
	t.after(() => {
		process.env.PATH = saved;
		writeFileSync(start, "");
		writeFileSync(gate, "");
	});
	process.env.PATH = [bin, saved].join(delimiter);
	const job = await jobs.spawn({ task: "Go." });
	const continuing = join(home, "jobs", job.id, "continuing");
	// The gap held open: once the refused continue read its own `continuing` to release it, the wrapper starts and removes it.
	const original = fs.readFileSync;
	t.mock.method(fs, "readFileSync", (...args: Parameters<typeof original>) => {
		const text = original(...args);
		if (args[0] !== continuing) return text;
		writeFileSync(start, "");
		for (const end = Date.now() + 20_000; existsSync(continuing) && Date.now() < end; ) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
		return text;
	});
	syncBuiltinESMExports();
	try {
		await assert.rejects(jobs.continue(job.id, "More."), { message: `${job.id} is working, in a run; a job in a run is not continued, arthur steer gives it a correction` });
	} finally {
		t.mock.restoreAll();
		syncBuiltinESMExports();
	}
	assert.equal(existsSync(continuing), false, "the wrapper removed it in the gap");
	writeFileSync(gate, "");
	const [data] = await ended(home, job.id);
	assert.deepEqual(data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
});

test("a continue waits for a wrapper of the job that wrote no pid yet and refuses to start a second one beside it", { timeout: 30_000 }, async (t) => {
	const { agent, resumed } = resuming({ steps: [{ message: "First." }] }, { steps: [{ message: "Second." }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	// As a continue killed while its new wrapper started leaves the record once the job ended: no `pid`, the wrapper running.
	rmSync(join(home, "jobs", job.id, "pid"));
	const wrapper = join(import.meta.dirname, "..", "src", "wrapper.ts");
	const lone = (...args: string[]) => spawn(process.execPath, ["-e", "setTimeout(() => {}, 300_000)", ...args], { stdio: "ignore" });
	// The wrapper's command line as `launch` starts it, and `arthur continue <id> <instruction>` whose instruction names it.
	const [starting, decoy] = [lone(wrapper, home, job.id, agent), lone("continue", job.id, "fix", wrapper, "now")];
	t.after(() => [starting, decoy].forEach((child) => child.kill()));
	await until("both in the process table", () => [starting.pid, decoy.pid].every((pid) => pid !== undefined && alive(pid)));
	const before = record(home, job.id);
	await assert.rejects(jobs.continue(job.id, "Two."), { message: `${job.id}: its wrapper ${starting.pid} still runs ${GRACE_SECONDS} seconds on; a second one is not started beside it` });
	assert.deepEqual(record(home, job.id), before, "a refused continue writes nothing and frees the record");
	assert.equal(starts(resumed).length, 0);
	starting.kill();
	await until("the wrapper gone", () => starting.exitCode !== null || starting.signalCode !== null);
	assert.equal(await jobs.continue(job.id, "Two."), undefined);
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual(second, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	assert.equal(starts(resumed).length, 1);
});

for (const scoped of [true, false])
	test(`two continues at once start one wrapper ${scoped ? "in its scope" : "bare, without a user manager"}: the other is refused, the record ends once`, { skip: scoped && !manager && "no systemd user manager" }, async (t) => {
		if (!scoped) bare(t);
		const gate = join(temporaryFolder(), "gate");
		const { agent, resumed } = resuming({ steps: [{ message: "First." }] }, { steps: [{ waitFor: gate }, { message: "Second." }] });
		const { home, jobs } = setup(agent);
		const job = await jobs.spawn({ task: "Go." });
		await ended(home, job.id);
		const both = await Promise.allSettled([jobs.continue(job.id, "One."), jobs.continue(job.id, "Two.")]);
		assert.deepEqual(both.map((result) => (result.status === "fulfilled" ? result.value : (result.reason as Error).message)), [undefined, `${job.id}: being continued`]);
		await running(home, job.id);
		await until("the record freed by the new wrapper", () => !existsSync(join(home, "jobs", job.id, "continuing")));
		await assert.rejects(jobs.continue(job.id, "Three."), { message: `${job.id} is working, in a run; a job in a run is not continued, arthur steer gives it a correction` });
		assert.equal(existsSync(join(home, "jobs", job.id, "continuing")), false, "a refused continue frees the record");
		writeFileSync(gate, "");
		const [, second, ...more] = await ended(home, job.id, 2);
		assert.deepEqual([second, more], [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }, []]);
		assert.deepEqual([starts(resumed).length, field(home, job.id, "continue"), field(home, job.id, "log")?.match(/\] arthur continue: /g)?.length], [1, "One.", 1]);
		assert.equal(field(home, job.id, "log")?.includes("no systemd scope"), !scoped);
	});

test("a continue takes over the `continuing` a killed continue left, and is refused while a live process holds it", async (t) => {
	const { agent, resumed } = resuming({ steps: [{ message: "First." }] }, { steps: [{ message: "Second." }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	const continuing = join(home, "jobs", job.id, "continuing");
	const live = spawn("sleep", ["300"]);
	t.after(() => live.kill());
	writeFileSync(continuing, String(live.pid));
	await assert.rejects(jobs.continue(job.id, "Two."), { message: `${job.id}: being continued` });
	assert.deepEqual([read(continuing), field(home, job.id, "continue"), starts(resumed).length], [String(live.pid), undefined, 0], "the holder keeps it");
	writeFileSync(continuing, String(spawnSync("true").pid));
	assert.equal(await jobs.continue(job.id, "Two."), undefined);
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual(second, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	assert.deepEqual([starts(resumed).length, field(home, job.id, "continue"), existsSync(continuing)], [1, "Two.", false]);
});

// Each `@` omp 18.3.0 reads a file for: at the start, after whitespace (a line break, a tab, a space, NBSP, an ideographic space,
// a BOM) and after each of ( [ { < " ' `; not one after any other character, `@` included.
const MENTIONS = "@/etc/passwd first.\n\nSee `@.env`, (@~/.ssh/id_ed25519) and\t@\"/home/me/my notes.md\" and @'.env'\n\"@a\" '@b' <@c> [@d] {@e}\nf\u00a0@f g\u3000@g h\ufeff@h; mail me@example.com, @@x.";
const ESCAPED = "\u2060@/etc/passwd first.\n\nSee `\u2060@.env`, (\u2060@~/.ssh/id_ed25519) and\t\u2060@\"/home/me/my notes.md\" and \u2060@'.env'\n\"\u2060@a\" '\u2060@b' <\u2060@c> [\u2060@d] {\u2060@e}\nf\u00a0\u2060@f g\u3000\u2060@g h\ufeff\u2060@h; mail me@example.com, \u2060@@x.";
test("the task and a continue's message omp gets name no file to read: each `@` omp would expand has a word joiner before it", async () => {
	const { agent, first, resumed } = resuming({ steps: [{ message: "First." }] }, { steps: [{ message: "Second." }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: MENTIONS });
	await ended(home, job.id);
	// omp reads the file its last argument names, `@<record>/task`, into the first message.
	const task = starts(first)[0]?.args.at(-1) ?? "";
	assert.equal(task, `@${join(home, "jobs", job.id, "task")}`);
	assert.equal(read(task.slice(1)), ESCAPED);
	assert.equal(await jobs.continue(job.id, MENTIONS), undefined);
	await ended(home, job.id, 2);
	assert.deepEqual(starts(resumed)[0]?.args.slice(-2), ["--", ESCAPED]);
});

test("continue is refused, with the id and the reason: a job in a run, a read-only kind, an unknown id, an empty instruction, a bad budget", async () => {
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await running(home, job.id);
	await assert.rejects(jobs.continue(job.id, "More."), { message: `${job.id} is working, in a run; a job in a run is not continued, arthur steer gives it a correction` });
	jobs.block(job.id, "machine mac unreachable");
	await assert.rejects(jobs.continue(job.id, "More."), { message: `${job.id} is blocked (dependency: machine mac unreachable), in a run; a job in a run is not continued, arthur steer gives it a correction` });
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

test("continue of a worker whose worktree prune freed, while Git keeps its unmerged branch, is refused and leaves the record", async () => {
	const { agent, resumed } = resuming({ steps: [{ message: "First." }] }, { steps: [{ message: "Second." }] });
	const { root, home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	git(job.worktree, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "work");
	const [line = ""] = jobs.prune([job.id]);
	assert.match(line, new RegExp(`^${job.id}: worktree ${job.worktree} removed; kept branch arthur/${job.id} and the record: `));
	assert.deepEqual([existsSync(job.worktree), git(root, "branch", "--list", `arthur/${job.id}`)], [false, `arthur/${job.id}`]);
	const before = record(home, job.id);
	await assert.rejects(jobs.continue(job.id, "Go on.", 3), { message: `${job.id}: its worktree was pruned; spawn a new job on its branch arthur/${job.id}` });
	assert.deepEqual(record(home, job.id), before);
	assert.equal(starts(resumed).length, 0);
});

test("a continue goes through the plugins' beforeSpawn checks on its record: a refusal starts nothing and leaves the record", async () => {
	const { agent, resumed } = resuming({ steps: [{ message: "First." }] }, { steps: [{ message: "Second." }] });
	const { home, jobs } = setup(agent);
	const seen: unknown[] = [];
	const answers: (string | undefined | Error)[] = [undefined, "maxAgents 1 reached", new Error("no process table"), undefined];
	jobs.beforeSpawn("orchestration", (spawn) => {
		seen.push(spawn);
		const answer = answers[seen.length - 1];
		if (answer instanceof Error) throw answer;
		return answer;
	});
	const job = await jobs.spawn({ task: "Ticket: README.md. Go.", model: "m" });
	await ended(home, job.id);
	const before = record(home, job.id);
	await assert.rejects(jobs.continue(job.id, "Go on.", 3), { message: "refused by orchestration: maxAgents 1 reached" });
	await assert.rejects(jobs.continue(job.id, "Go on."), { message: "plugin orchestration: beforeSpawn failed: no process table" });
	assert.deepEqual(record(home, job.id), before);
	assert.equal(starts(resumed).length, 0);
	const spawn = { id: job.id, task: "Ticket: README.md. Go.", kind: "worker", project: "acme", model: "m", thinking: undefined, quick: undefined, timeoutMinutes: 120, free: false, tickets: ["README.md"], machine: "local", ignoreRestart: false, branch: job.branch, worktree: job.worktree };
	assert.partialDeepStrictEqual(seen.slice(1), [{ ...spawn, budgetUsd: 3 }, { ...spawn, budgetUsd: 2 }], "the job as its record holds it, the --budget replacing its own");
	assert.equal(await jobs.continue(job.id, "Go on."), undefined);
	const [, second] = await ended(home, job.id, 2);
	assert.deepEqual([second, starts(resumed).length], [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }, 1]);
});

test("a continue hands the checks its decision on a paid model only: none once its record says free", async () => {
	const { agent } = resuming({ steps: [{ message: "First." }] }, { steps: [{ message: "Second." }] });
	const { home, jobs } = setup(agent);
	const seen: (string | undefined)[] = [];
	jobs.beforeSpawn("orchestration", (spawn) => (seen.push(spawn.decision), spawn.id === undefined ? undefined : "held"));
	const job = await jobs.spawn({ task: "Go." });
	await ended(home, job.id);
	await assert.rejects(jobs.continue(job.id, "Go on.", 0, false, "AC-D1"), { message: "refused by orchestration: held" });
	writeFileSync(join(home, "jobs", job.id, "free"), "true");
	await assert.rejects(jobs.continue(job.id, "Go on.", 0, false, "AC-D1"), { message: "refused by orchestration: held" });
	assert.deepEqual(seen, [undefined, "AC-D1", undefined]);
});

test("a continued worker moves its ticket from review back to in-progress with one ticket-moved; at in-progress nothing is written", async () => {
	const { agent } = resuming({ steps: [{ message: "First." }] }, { steps: [{ message: "Again." }] });
	const { root, home, jobs, bus } = setup(agent);
	const ticket = "spec/features/AC0001-one/ticket.md";
	mkdirSync(join(root, dirname(ticket)), { recursive: true });
	writeFileSync(join(root, ticket), "# AC0001\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "ticket");
	const path = join(root, "spec", "build.json");
	writeFileSync(path, JSON.stringify([{ id: "AC0001", title: "One", status: "planned", path: ticket, updated: "2026-10-16T07:00:00.000Z" }]));
	const core = board(() => [[{ name: "acme", path: root, prefix: "AC" }]], clock("UTC", undefined, () => new Date("2026-10-16T08:00:00Z")), (name, data) => bus.emit("core", name, data));
	refuseUnstartableTickets(core, jobs);
	moveStartedTickets(core, bus);
	const status = () => core.get("AC0001")?.status;
	const events = (name: string) => readEvents(home, 1).filter((event) => event.name === name).map((event) => event.data);
	const worker = await jobs.spawn({ task: `Ticket: ${ticket}. Build it.` });
	await ended(home, worker.id);
	core.move("AC0001", "review");
	// A kind with a branch that is not a worker moves no ticket at its start nor at its continue.
	const audit = await jobs.spawn({ task: `Ticket: ${ticket}. Audit it.`, kind: "audit" });
	await ended(home, audit.id);
	assert.equal(await jobs.continue(audit.id, "Go on."), undefined);
	await ended(home, audit.id, 2);
	assert.equal(status(), "review");
	const moves = events("ticket-moved").length;
	assert.equal(await jobs.continue(worker.id, "Go on."), undefined);
	await ended(home, worker.id, 2);
	assert.equal(status(), "in-progress");
	assert.deepEqual(events("ticket-moved").slice(moves), [{ id: "AC0001", project: "acme", from: "review", to: "in-progress" }]);
	const started = events("job-started").filter((data) => (data as { id: string }).id === worker.id);
	assert.deepEqual(started, [started[0], started[0]], "the continue's job-started is the spawn's");
	const [text, written] = [readFileSync(path, "utf8"), statSync(path).mtimeMs];
	assert.equal(await jobs.continue(worker.id, "Once more."), undefined);
	await ended(home, worker.id, 3);
	assert.deepEqual([readFileSync(path, "utf8"), statSync(path).mtimeMs, events("ticket-moved").length], [text, written, moves + 1]);
});

test("the arthur binary stops, steers and continues a job by its id; wrong usage exits 2, a refusal 1", async () => {
	const root = join(temporaryFolder(), "acme");
	mkdirSync(root);
	writeFileSync(join(root, ".gitignore"), ".arthur/\n");
	git(root, "init", "--quiet", "--initial-branch=main");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const agent = fakeAgent({ steps: [stuck()] });
	const full = join(root, "..", "full");
	const check = `host.jobs.beforeSpawn((spawn) => (spawn.decision !== undefined ? \`decision \${JSON.stringify(spawn.decision)} of \${spawn.id}\` : existsSync(${JSON.stringify(full)}) && !spawn.ignoreRestart ? "restart due: AC0001" : undefined))`;
	writeFileSync(join(root, "arthur.config.ts"), `import { existsSync } from "node:fs";\nexport default { core: { timeZone: "UTC", agent: { command: ${JSON.stringify(agent)} } }, plugins: [{ name: "orchestration", setup(host) { ${check}; } }] };\n`);
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, ARTHUR_JOB_SLICE: jobSlice.slice } });
	const home = join(root, ".arthur");
	const id = arthur("spawn", "Go.").stdout.trim();
	await running(home, id);
	// The sandbox's walk to hide the env file (AR0443) can outlast `running`: the agent's start is what the count below asserts.
	await until("the agent's first start", () => (starts(agent).length === 1 ? true : undefined));
	assert.deepEqual([arthur("steer", id, "Mind the tests.").stdout, arthur("stop", id).stdout], [`${id}: steer 0001 queued for after its next tool call\n`, `${id}: stopped\n`]);
	assert.deepEqual(await ended(home, id), [{ id, kind: "worker", project: "acme", state: "ended", reason: "stopped", undelivered: ["0001"] }]);
	writeFileSync(full, "");
	const capped = arthur("continue", id, "Go on.");
	assert.deepEqual([capped.status, capped.stdout, capped.stderr, starts(agent).length, field(home, id, "continue")], [1, "", "arthur continue: refused by orchestration: restart due: AC0001\n", 1, undefined]);
	// `--budget 0` on its paid model hands the checks its `--decision`, "" for none, with the job's id (AR0355).
	for (const [args, decision] of [[["--budget", "0"], '""'], [["--decision", "AC-D1", "--budget", "0.00"], '"AC-D1"']] as const) {
		const asked = arthur("continue", id, "Go on.", "--ignore-restart", ...args);
		assert.deepEqual([asked.status, asked.stderr], [1, `arthur continue: refused by orchestration: decision ${decision} of ${id}\n`], args.join(" "));
	}
	assert.equal(arthur("continue", id, "Go on.", "--ignore-restart", "--budget", "0.5").stdout, `${id}: continued\n`);
	await running(home, id);
	const [, second] = await until("the agent's second start", () => (starts(agent).length === 2 ? starts(agent) : undefined));
	assert.deepEqual([field(home, id, "budget"), second?.args.slice(0, 1), second?.args.at(-1)], ["0.5", ["--continue"], "Go on."]);
	assert.equal(arthur("stop", id).stdout, `${id}: stopped\n`);
	const usage = { stop: "usage: arthur stop <id>", steer: "usage: arthur steer <id> <text>", continue: "usage: arthur continue <id> <instruction> [--budget <usd> [--decision <id>]] [--ignore-restart]" };
	for (const [args, problem] of [
		[["stop"], "expected the id, got 0 arguments"],
		[["stop", id, "--force"], "unknown flag --force"],
		[["steer", id], "expected the id and one quoted text, got 1 arguments"],
		[["steer", id, "a", "b"], "expected the id and one quoted text, got 3 arguments"],
		[["steer", id, "a", "--budget", "1"], "unknown flag --budget"],
		[["continue", id, "x", "--budget", "1e3"], "--budget needs a number of 0 or more, got 1e3"],
		[["continue", id, "x", "--budget"], "--budget needs a number of 0 or more, got nothing"],
		[["continue", id, "x", "--budget", "1", "--budget", "2"], "--budget given twice"],
		[["continue", id, "x", "--decision", "AC-D1"], "--decision goes with --budget 0"],
		[["continue", id, "x", "--budget", "1", "--decision", "AC-D1"], "--decision goes with --budget 0"],
		[["continue", id, "x", "--budget", "0", "--decision"], "--decision needs a value"],
	] as const) {
		const run = arthur(...args);
		assert.deepEqual([run.status, run.stderr], [2, `arthur ${args[0]}: ${problem}\n${usage[args[0]]}\n`], args.join(" "));
	}
	const refused = arthur("stop", id);
	assert.deepEqual([refused.status, refused.stderr], [1, `arthur stop: ${id} is ended (stopped), not in a run; nothing to stop\n`]);
	writeFileSync(join(root, "arthur.config.ts"), "export default { plugins: [] };\n");
	const unloaded = arthur("steer", id, "x");
	assert.equal(unloaded.status, 1);
	assert.match(unloaded.stderr, /^arthur steer: the job records are in the configured home folder, and arthur\.config\.ts did not load:\n/);
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { moveJob, quiet } from "../src/job-state.ts";
import { type JobRunner, jobRunner } from "../src/jobs.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const TASK = "Go.\nTicket: spec/features/AR0007-tables/ticket.md";
const NOW = new Date("2026-10-16T12:00:00Z");

// A repository `acme` with the ticket the task names, a home folder beside it, and a runner on `agent` whose jobs turn idle
// after `idleMinutes`; its clock is the real one, or stands at `now()`.
function setup(agent: string, idleMinutes = 10, now?: () => Date): { readonly home: string; readonly jobs: JobRunner } {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(join(root, "spec", "features", "AR0007-tables"), { recursive: true });
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "spec", "features", "AR0007-tables", "ticket.md"), "# AR0007\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const home = join(folder, "home");
	const jobs = jobRunner(home, root, { timeoutMinutes: 120, budgetUsd: 2, idleMinutes, offlineGraceMinutes: 30, ...jobSlice }, agent, clock("UTC", undefined, now), eventBus(home), () => []);
	return { home, jobs };
}

async function until<T>(what: string, predicate: () => T | undefined | false): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

const field = (home: string, id: string, name: string) => readFileSync(join(home, "jobs", id, name), "utf8");
// Each `job-state` of job `id`, as [from, to, reason].
const moves = (home: string, id: string) =>
	readEvents(home, 1).flatMap(({ name, data }) => {
		const { id: of, from, to, reason } = data as { id: string; from: string; to: string; reason: string };
		return name === "job-state" && of === id ? [[from, to, reason]] : [];
	});
const ends = (home: string, id: string) => readEvents(home, 1).filter(({ name, data }) => name === "job-ended" && (data as { id: string }).id === id);
// How long ago the agent's last output was, in ms.
const silent = (home: string, id: string) => Date.now() - statSync(join(home, "jobs", id, "active")).mtimeMs;

// Each fake-agent run, its `idleMinutes`, when the test opens its gate (the run's `waitFor`), and the states it passes through.
type Row = readonly [string, (gate: string) => AgentRun, number, ((home: string, id: string) => boolean) | undefined, readonly (readonly string[])[]];
const STATES: readonly Row[] = [
	["a finished run", () => ({ steps: [{ tool: "read", args: { path: "README.md" } }, { message: "Done." }] }), 10, undefined, [["working", "ended", "finished"]]],
	["a failed run", () => ({ steps: [{ message: "Done." }], exitCode: 2 }), 10, undefined, [["working", "ended", "failed: the agent exited 2"]]],
	["Blocked: user", () => ({ steps: [{ message: "Blocked: user may I drop the old table?\nWhat I did so far." }] }), 10, undefined, [["working", "blocked", "user: may I drop the old table?"]]],
	["Blocked: on", () => ({ steps: [{ message: "Blocked: on AR0006\nIt needs the schema first." }] }), 10, undefined, [["working", "blocked", "dependency: AR0006"]]],
	["a Blocked: line that is not the first", () => ({ steps: [{ message: "Done.\nBlocked: user may I?" }] }), 10, undefined, [["working", "ended", "finished"]]],
	[
		"silence for idleMinutes, then a tool call",
		(gate) => ({ steps: [{ tool: "read", args: { path: "README.md" } }, { waitFor: gate }, { tool: "read", args: { path: "README.md" } }, { message: "Done." }] }),
		0.05,
		(home, id) => field(home, id, "state") === "idle",
		[["working", "idle", ""], ["idle", "working", ""], ["working", "ended", "finished"]],
	],
	[
		"silence with idleMinutes 0",
		(gate) => ({ steps: [{ tool: "read", args: { path: "README.md" } }, { waitFor: gate }, { message: "Done." }] }),
		0,
		(home, id) => silent(home, id) > 3_500,
		[["working", "ended", "finished"]],
	],
];

for (const [name, run, idleMinutes, open, expected] of STATES)
	test(`job states of ${name}: ${expected.map(([from, to]) => `${from} -> ${to}`).join(", ")}`, async () => {
		const gate = join(temporaryFolder(), "gate");
		const { home, jobs } = setup(fakeAgent(run(gate)), idleMinutes);
		const job = await jobs.spawn({ task: TASK });
		assert.deepEqual(["state", "reason"].map((key) => field(home, job.id, key)), ["working", ""], "a spawn writes working");
		if (open !== undefined) {
			await until("the gate's condition", () => open(home, job.id));
			writeFileSync(gate, "");
		}
		const [end] = await until("job-ended", () => (ends(home, job.id).length > 0 ? ends(home, job.id) : undefined));
		const [, last] = expected.at(-1) ?? [];
		assert.deepEqual(moves(home, job.id), expected);
		assert.deepEqual(end?.data, { id: job.id, kind: "worker", project: "acme", state: last, reason: expected.at(-1)?.[2] });
		assert.deepEqual(["state", "reason"].map((key) => field(home, job.id, key)), expected.at(-1)?.slice(1));
		const state = readEvents(home, 1).find((event) => event.name === "job-state");
		assert.deepEqual(Object.keys(state?.data ?? {}), ["id", "project", "ticket", "machine", "from", "to", "reason"]);
		assert.deepEqual([(state?.data as { ticket: string }).ticket, (state?.data as { machine: string }).machine], ["AR0007", "local"]);
	});

test("idle is no activity for exactly idleMinutes: one minute less is not, and 0 is never", () => {
	const at = NOW.getTime();
	assert.equal(quiet(at, at + 10 * 60_000, 10), true);
	assert.equal(quiet(at, at + 9 * 60_000, 10), false);
	assert.equal(quiet(at, at + 10 * 60_000 - 1, 10), false);
	assert.equal(quiet(at, at + 1e12, 0), false);
});

// A record as a spawn leaves it, the agent last active at NOW; the runner's clock at `now.at`.
function held(idleMinutes = 10) {
	const now = { at: NOW };
	const { home, jobs } = setup(fakeAgent({ steps: [] }), idleMinutes, () => now.at);
	const id = "2026-10-16-worker-0000000a";
	const folder = join(home, "jobs", id);
	mkdirSync(folder, { recursive: true });
	const record = { kind: "worker", project: "acme", task: TASK, "idle-minutes": String(idleMinutes), reason: "", since: NOW.toISOString(), state: "working", active: "" };
	for (const [key, value] of Object.entries(record)) writeFileSync(join(folder, key), value);
	utimesSync(join(folder, "active"), NOW, NOW);
	return { home, jobs, id, now };
}

test("a move to the state and reason a job is in emits nothing: a second block with the same reason", () => {
	const { home, jobs, id } = held();
	jobs.block(id, "  machine mac\nunreachable ");
	jobs.block(id, "machine mac unreachable");
	assert.equal(moveJob(home, id, eventBus(home), () => ["blocked", "dependency: machine mac unreachable"]), false);
	jobs.block(id, "cap reached");
	assert.deepEqual(moves(home, id), [
		["working", "blocked", "dependency: machine mac unreachable"],
		["blocked", "blocked", "dependency: cap reached"],
	]);
});

test("block is refused for an empty reason, an unknown id, and a job not in a run: ended, or blocked by its run's end", () => {
	const { home, jobs, id } = held();
	for (const reason of ["", " \n "]) assert.throws(() => jobs.block(id, reason), { message: `block ${id}: the reason is empty` });
	for (const unknown of ["2026-10-16-worker-00000000", "../../etc"]) {
		assert.throws(() => jobs.block(unknown, "x"), { message: `${unknown}: no such job in ${join(home, "jobs")}` });
	}
	moveJob(home, id, eventBus(home), () => ["blocked", "user: may I?"]);
	assert.throws(() => jobs.block(id, "x"), { message: `block ${id}: it is blocked (user: may I?), not in a run; only a job in a run is held` });
	moveJob(home, id, eventBus(home), () => ["ended", "finished"]);
	assert.throws(() => jobs.block(id, "x"), { message: `block ${id}: it is ended (finished), not in a run; only a job in a run is held` });
	assert.equal(existsSync(join(home, "jobs", id, "hold")), false);
});

test("a plugin's block wins over idle and over the agent's output; the run's end ends the hold", async () => {
	const gates = temporaryFolder();
	const agent = fakeAgent({ steps: [{ waitFor: join(gates, "one") }, { tool: "read", args: { path: "README.md" } }, { waitFor: join(gates, "two") }, { message: "Done." }] });
	const { home, jobs } = setup(agent, 0.05);
	const job = await jobs.spawn({ task: TASK });
	jobs.block(job.id, "machine mac unreachable");
	await until("silence past idleMinutes", () => silent(home, job.id) > 4_000);
	writeFileSync(join(gates, "one"), "");
	await until("the tool call", () => existsSync(join(home, "jobs", job.id, "tool-calls")) && field(home, job.id, "tool-calls") === "1");
	assert.equal(field(home, job.id, "state"), "blocked");
	jobs.block(job.id, "cap reached");
	writeFileSync(join(gates, "two"), "");
	await until("job-ended", () => ends(home, job.id).length > 0);
	assert.deepEqual(moves(home, job.id), [
		["working", "blocked", "dependency: machine mac unreachable"],
		["blocked", "blocked", "dependency: cap reached"],
		["blocked", "ended", "finished"],
	]);
	assert.equal(existsSync(join(home, "jobs", job.id, "hold")), false);
});

test("arthur continue moves a run that ended blocked back to working and clears its reason", async () => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Blocked: user which table?" }] }));
	const job = await jobs.spawn({ task: TASK });
	await until("job-ended", () => ends(home, job.id).length > 0);
	assert.equal(await jobs.continue(job.id, "The orders table."), undefined);
	await until("the second job-ended", () => ends(home, job.id).length > 1);
	assert.deepEqual(moves(home, job.id), [
		["working", "blocked", "user: which table?"],
		["blocked", "working", ""],
		["working", "blocked", "user: which table?"],
	]);
});

test("a block with stop stops the run and holds the job blocked on the user once it ended, whatever the outcome; arthur continue resumes it", async () => {
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: TASK });
	await until("the wrapper's pid", () => existsSync(join(home, "jobs", job.id, "pid")));
	await jobs.block(job.id, "feature cap budgetUsd reached: $2.0000 of $2", true);
	const reason = "user: feature cap budgetUsd reached: $2.0000 of $2";
	assert.deepEqual([field(home, job.id, "state"), field(home, job.id, "reason"), existsSync(join(home, "jobs", job.id, "hold"))], ["blocked", reason, false]);
	// The block resolves once the state is final; the wrapper emits job-ended after it.
	await until("job-ended", () => ends(home, job.id).length > 0);
	assert.deepEqual(ends(home, job.id).map(({ data }) => data), [{ id: job.id, kind: "worker", project: "acme", state: "blocked", reason }]);
	assert.deepEqual(jobs.running(), []);
	assert.match(field(home, job.id, "log"), /arthur stop: stopping the agent\n.*blocked: user: feature cap/);
	writeFileSync(gate, "");
	assert.equal(await jobs.continue(job.id, "The cap was raised; go on."), undefined);
	await until("the second job-ended", () => ends(home, job.id).length > 1);
	assert.deepEqual([field(home, job.id, "state"), field(home, job.id, "reason")], ["ended", "finished"], "a plain block ends with the run again");
});

test("ran adds each spell in a run, held ones included, and not the time out of one; records count a run up to the runner's clock", () => {
	const { home, jobs, id, now } = held();
	const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
	const bus = eventBus(home);
	moveJob(home, id, bus, () => ["idle", ""], at(60));
	moveJob(home, id, bus, () => ["blocked", "user: which?"], at(90));
	moveJob(home, id, bus, () => ["working", ""], at(1000));
	assert.equal(field(home, id, "ran"), "90");
	now.at = at(1010);
	jobs.block(id, "waiting");
	now.at = at(1030);
	assert.deepEqual([field(home, id, "ran"), jobs.records().find((job) => job.id === id)?.seconds], ["100", 120]);
	writeFileSync(join(home, "jobs", id, "ran"), "broken");
	moveJob(home, id, bus, () => ["ended", "finished"], at(1040));
	assert.deepEqual([field(home, id, "ran"), jobs.records()[0]?.seconds], ["30", 30], "a broken ran starts again from 0, an ended job counts no more");
});

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { loadConfig } from "../src/config.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import type { Caps, Slice } from "../src/job-scope.ts";
import { jobRunner, type Spawn } from "../src/jobs.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

// Every job here runs in the kit's slice, `jobSlice`, never Arthur's own, and the kit removes it when the process exits.
const manager = spawnSync("systemctl", ["--user", "show-environment"]).status === 0;
const needsManager = { skip: !manager && "no systemd user manager" };
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const show = (unit: string, property: string) => execFileSync("systemctl", ["--user", "show", unit, "-p", property, "--value"], { encoding: "utf8" }).trim();

// A repository `acme`, a home folder beside it, and a runner whose agent is `agent`, its jobs in `slice`; `caps` answers each
// spawn's `jobs.limits`, one answer per plugin that provides it.
function setup(agent: string, slice: Slice = jobSlice, caps: (spawn: Spawn) => readonly Caps[] = () => []) {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "first");
	const home = join(folder, "home");
	const time = clock("UTC", undefined, () => new Date("2026-10-16T08:00:00Z"));
	const collect = (name: string, [spawn]: readonly unknown[]) => (name === "jobs.limits" ? [...caps(spawn as Spawn)] : []);
	return { home, jobs: jobRunner(home, root, { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...slice }, agent, time, eventBus(home), collect) };
}

async function until<T>(what: string, predicate: () => T | undefined): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8").trim() || undefined : undefined);
const ended = (home: string) => until("job-ended", () => readEvents(home, 1).find((event) => event.name === "job-ended"));
// The cgroup of a live process; a zombie, killed and not reaped yet, is not running.
const cgroup = (pid: number) => read(`/proc/${pid}/cgroup`);
const running = (pid: number) => !/^\d+ \(.*\) Z /.test(read(`/proc/${pid}/stat`) ?? `${pid} (gone) Z `);

// An agent that first forks a daemon, in a session of its own and so out of the job's process group, notes its pid in
// `<folder>/daemon`, then plays `run` as the fake agent.
function forking(run: AgentRun): { readonly agent: string; readonly daemon: () => number | undefined } {
	const folder = temporaryFolder();
	const script = [
		"#!/bin/sh",
		`setsid sh -c 'echo $$ > "${folder}/daemon"; exec sleep 300' </dev/null >/dev/null 2>&1 &`,
		`while [ ! -s '${folder}/daemon' ]; do sleep 0.02; done`,
		`exec '${fakeAgent(run)}' "$@"`,
	];
	writeFileSync(join(folder, "omp"), `${script.join("\n")}\n`, { mode: 0o755 });
	const daemon = () => {
		const pid = read(join(folder, "daemon"));
		return pid === undefined ? undefined : Number(pid);
	};
	return { agent: join(folder, "omp"), daemon };
}

test("a job runs, with its agent, in its own scope inside the joint slice, which gets core.jobs.cpu and core.jobs.memory", needsManager, async () => {
	const gate = join(temporaryFolder(), "gate");
	const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] });
	const { home, jobs } = setup(agent, { ...jobSlice, cpu: 1.5, memory: "1G" });
	const job = await jobs.spawn({ task: "Go." });
	const record = join(home, "jobs", job.id);
	const wrapper = Number(await until("the wrapper's pid", () => read(join(record, "pid"))));
	const started = await until("the agent's start", () => read(join(agent, "..", "starts.jsonl")));
	const scope = `/${jobSlice.slice}.slice/arthur-job-${job.id}.scope`;
	assert.ok(cgroup(wrapper)?.endsWith(scope), `the wrapper: ${cgroup(wrapper)}`);
	const pid = (JSON.parse(started) as { readonly pid: number }).pid;
	assert.ok(cgroup(pid)?.endsWith(scope), `the agent: ${cgroup(pid)}`);
	assert.deepEqual([show(`${jobSlice.slice}.slice`, "CPUQuotaPerSecUSec"), show(`${jobSlice.slice}.slice`, "MemoryMax")], ["1.500000s", String(2 ** 30)]);
	assert.doesNotMatch(read(join(record, "log")) ?? "", /no systemd scope/);
	writeFileSync(gate, "");
	assert.deepEqual((await ended(home)).data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
});

test("core.jobs.cpu left undefined gives the slice the host's cores minus one, at least one", needsManager, async () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), 'export default { core: { jobs: { memory: "1G" } } };\n');
	const config = await loadConfig(join(folder, "arthur.config.ts"));
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }), { ...config.core.jobs, slice: jobSlice.slice });
	await jobs.spawn({ task: "Go." });
	await ended(home);
	assert.equal(show(`${jobSlice.slice}.slice`, "CPUQuotaPerSecUSec"), `${Math.max(1, availableParallelism() - 1)}s`);
});

test("a job that forks a daemon leaves nothing running once its state is final, and its scope is gone", needsManager, async () => {
	const { agent, daemon } = forking({ steps: [{ message: "Done." }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const event = await ended(home);
	const pid = daemon();
	assert.ok(pid !== undefined && !running(pid), `the daemon ${pid} still runs`);
	assert.equal(readFileSync(join(home, "jobs", job.id, "state"), "utf8"), "ended");
	assert.deepEqual(event.data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	await until("the scope's end", () => show(`arthur-job-${job.id}.scope`, "ActiveState") === "inactive");
});

test("a record deleted while the job runs kills the daemon its agent forked as well", needsManager, async () => {
	const gate = join(temporaryFolder(), "gate");
	const { agent, daemon } = forking({ steps: [{ waitFor: gate }, { message: "Still here.", stopReason: "toolUse" }, { waitFor: join(gate, "never") }] });
	const { home, jobs } = setup(agent);
	const job = await jobs.spawn({ task: "Go." });
	const pid = await until("the daemon", daemon);
	assert.ok(running(pid));
	rmSync(join(home, "jobs", job.id), { recursive: true });
	writeFileSync(gate, "");
	await until("the wrapper's line", () => read(join(home, "wrapper.log"))?.includes(`job ${job.id}: its record`));
	assert.ok(!running(pid), `the daemon ${pid} still runs`);
});

test("without a user manager the job runs bare, its log saying so in one line, and ends as usual; without caps nothing more is told", async (t) => {
	noManager(t);
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	const wrapper = Number(await until("the wrapper's pid", () => read(join(home, "jobs", job.id, "pid"))));
	if (existsSync("/proc")) assert.doesNotMatch(cgroup(wrapper) ?? "", /arthur-job-/);
	writeFileSync(gate, "");
	assert.deepEqual((await ended(home)).data, { id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	const log = readFileSync(join(home, "jobs", job.id, "log"), "utf8");
	const line = /^\[arthur [^\]]+\] no systemd scope: [^\n]+; the job runs bare, without the joint limit of core\.jobs\.cpu and core\.jobs\.memory, and what it leaves behind is not killed at its end\n\[arthur [^\]]+\] agent: /;
	assert.match(log, line);
	assert.equal(log.match(/no systemd scope/g)?.length, 1, log);
	assert.deepEqual(readEvents(home, 1).filter((event) => event.name === "notice"), []);
});

test("without a user manager a job with only its ticket's caps runs bare, and the machine is told once that they are not held", async (t) => {
	noManager(t);
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }), jobSlice, () => [{ feature: { name: "AC0001", cpu: 1, memory: "1G" } }]);
	for (const task of ["One.", "Two."]) assert.equal(await endedWith(home, (await jobs.spawn({ task })).id), "finished");
	const notices = readEvents(home, 1).filter((event) => event.name === "notice").map((event) => JSON.stringify(event.data));
	assert.equal(notices.length, 1, notices.join("\n"));
	assert.match(notices[0] ?? "", /^\{"text":"machine local runs jobs without a systemd scope \(.+\): .*, and a ticket's CPU and memory caps, shared by all its jobs, are not held"\}$/);
});

// A folder on `PATH` until the test ends, first, or `alone`: a `systemctl` that sets any slice, and each script of `scripts`
// under its name.
function onPath(t: TestContext, scripts: Readonly<Record<string, string>>, alone = false): void {
	const bin = temporaryFolder();
	for (const [name, body] of Object.entries({ systemctl: "exit 0", ...scripts })) writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
	const saved = process.env.PATH;
	t.after(() => void (process.env.PATH = saved));
	process.env.PATH = alone ? bin : [bin, saved].join(delimiter);
}

// A job whose wrapper did not start, as `spawn` returns it: ended `failed: <reason>`, the reason `reasonIn` gives for the home
// folder, its one `job-ended` emitted, the record's end written, no agent started, and its worktree and branch kept.
async function endedAtSpawn(reasonIn: (home: string) => string): Promise<number> {
	const agent = fakeAgent({ steps: [{ message: "Done." }] });
	const { home, jobs } = setup(agent);
	const reason = reasonIn(home);
	const job = await jobs.spawn({ task: "Go." });
	assert.equal(job.failed, reason);
	const events = readEvents(home, 1).filter((event) => event.name === "job-ended");
	assert.deepEqual(events.map((event) => event.data), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: `failed: ${reason}` }]);
	const folder = join(home, "jobs", job.id);
	const end = ["state", "reason", "result", "cost", "tool-calls", "activity", "commits"].map((name) => readFileSync(join(folder, name), "utf8"));
	assert.deepEqual(end, ["ended", `failed: ${reason}`, "", "0.0000", "0", "", ""]);
	assert.ok(readFileSync(join(folder, "log"), "utf8").endsWith(`] ended: failed: ${reason}\n`));
	assert.equal(existsSync(join(dirname(agent), "starts.jsonl")), false, "no agent started");
	assert.ok(existsSync(join(job.worktree, "README.md")));
	assert.equal(git(job.root, "branch", "--list", `arthur/${job.id}`).replace(/^[*+]?\s*/, ""), `arthur/${job.id}`);
	return Date.now();
}

test("a systemd-run that refuses the scope ends the job failed at spawn with its first stderr line", async (t) => {
	onPath(t, { "systemd-run": "printf '\\nFailed to start transient scope unit: Access denied\\nSee the logs.\\n' >&2; exit 1" });
	await endedAtSpawn(() => "systemd-run: Failed to start transient scope unit: Access denied");
});

test("a systemd-run that exits before the wrapper wrote its pid, without a word, ends the job failed at spawn", async (t) => {
	onPath(t, { "systemd-run": "exit 3" });
	await endedAtSpawn((home) => `the wrapper exited 3 before it wrote its pid; see ${join(home, "wrapper.log")}`);
});

test("a systemd-run missing while systemctl is there ends the job failed at spawn", async (t) => {
	const real = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
	onPath(t, { git: `exec '${real}' "$@"` }, true);
	await endedAtSpawn(() => "systemd-run: spawn systemd-run ENOENT");
});

test("a wrapper that writes no pid within 10 s is killed, and the job ends failed at spawn", async (t) => {
	const noted = join(temporaryFolder(), "pid");
	onPath(t, { "systemd-run": `echo $$ > '${noted}'; exec sleep 300` });
	const start = Date.now();
	const end = await endedAtSpawn(() => "the wrapper wrote no pid within 10 s and was killed");
	assert.ok(end - start >= 10_000, `ended after ${end - start} ms`);
	assert.equal(running(Number(read(noted))), false, "the sleep it ran is gone");
});

// No user manager to reach until the test ends: as in a container, and as on macOS, where `systemctl` is missing.
function noManager(t: TestContext): void {
	const saved = { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS };
	t.after(() => Object.assign(process.env, saved));
	process.env.XDG_RUNTIME_DIR = temporaryFolder();
	delete process.env.DBUS_SESSION_BUS_ADDRESS;
}

// An agent that, while the file `on()` names exists, removes it and starts `node` holding `mb` MB in its own process group,
// which notes its pid in `hog` once it holds them; else it takes back the `oom_score_adj` of this process, which its wrapper
// keeps, so over a cap two jobs share the kernel takes the hog's job, the hog and its agent at 1000, never this one. Then it
// plays `run` as the fake agent, which notes each start in `starts`.
function hogging(mb: number, run: AgentRun): { readonly agent: string; readonly on: string; readonly hog: string; readonly starts: string } {
	const folder = temporaryFolder();
	const [on, hog] = [join(folder, "on"), join(folder, "hog")];
	const code = `const a = []; for (let i = 0; i < ${mb}; i += 16) a.push(Buffer.alloc(16 << 20, 1)); require("fs").writeFileSync("${hog}", String(process.pid)); setInterval(() => a.length, 1000);`;
	const played = fakeAgent(run);
	const own = existsSync("/proc/self/oom_score_adj") ? readFileSync("/proc/self/oom_score_adj", "utf8").trim() : "";
	const restore = own === "" ? ":" : `echo ${own} > /proc/self/oom_score_adj`;
	const script = ["#!/bin/sh", `if [ -e '${on}' ]; then rm '${on}'; '${process.execPath}' -e '${code}' & else ${restore}; fi`, `exec '${played}' "$@"`];
	writeFileSync(join(folder, "omp"), `${script.join("\n")}\n`, { mode: 0o755 });
	return { agent: join(folder, "omp"), on, hog, starts: join(dirname(played), "starts.jsonl") };
}

// The reason job `id` ended with, once its record says it ended.
const endedWith = (home: string, id: string) => until(`${id}'s end`, () => read(join(home, "jobs", id, "state")) === "ended" && read(join(home, "jobs", id, "reason")));

test("a job's own caps go on its scope: its CPUQuota, at most the machine's cores, and its MemoryMax with no swap", needsManager, async () => {
	const gate = join(temporaryFolder(), "gate");
	const cores = availableParallelism();
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }), jobSlice, (spawn) => [spawn.task === "Small." ? { cpu: 0.5, memory: "300M" } : { cpu: cores + 2 }]);
	const [small, large] = [await jobs.spawn({ task: "Small." }), await jobs.spawn({ task: "Large." })];
	await until("both wrappers", () => [small, large].every((job) => read(join(home, "jobs", job.id, "pid")) !== undefined));
	const unit = (id: string) => `arthur-job-${id}.scope`;
	assert.deepEqual(["CPUQuotaPerSecUSec", "MemoryMax", "MemorySwapMax"].map((property) => show(unit(small.id), property)), ["500ms", String(300 * 2 ** 20), "0"]);
	assert.deepEqual(["CPUQuotaPerSecUSec", "MemoryMax"].map((property) => show(unit(large.id), property)), [`${cores}s`, "infinity"]);
	assert.deepEqual([read(join(home, "jobs", small.id, "cpu")), read(join(home, "jobs", small.id, "memory"))], ["0.5", "300M"]);
	writeFileSync(gate, "");
	for (const job of [small, large]) assert.equal(await endedWith(home, job.id), "finished", "CPU over its cap is slowed, not stopped");
});

test("arthur continue sets the ticket's slice to the caps in force now, not to those kept at the job's spawn; a memory cap with no swap beyond it", needsManager, async () => {
	const gate = join(temporaryFolder(), "gate");
	let answer: Caps = { feature: { name: "AC0001", cpu: 1, memory: "300M" } };
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }), jobSlice, () => [answer]);
	const job = await jobs.spawn({ task: "Go." });
	const slice = `${jobSlice.slice}-AC0001.slice`;
	const limits = ["CPUQuotaPerSecUSec", "MemoryMax", "MemorySwapMax"];
	assert.deepEqual(limits.map((property) => show(slice, property)), ["1s", String(300 * 2 ** 20), "0"]);
	// The joint slice keeps its swap: only a ticket's slice gets MemorySwapMax.
	assert.deepEqual(limits.map((property) => show(`${jobSlice.slice}.slice`, property)), ["2s", String(2 * 2 ** 30), "infinity"]);
	writeFileSync(gate, "");
	assert.equal(await endedWith(home, job.id), "finished");
	rmSync(gate);
	answer = { memory: "400M", feature: { name: "AC0001" } };
	assert.equal(await jobs.continue(job.id, "Go on."), undefined);
	assert.deepEqual(limits.map((property) => show(slice, property)), ["infinity", "infinity", "infinity"]);
	assert.equal(show(`arthur-job-${job.id}.scope`, "MemoryMax"), String(400 * 2 ** 20));
	assert.deepEqual(["cpu", "memory", "feature", "feature-cpu", "feature-memory"].map((name) => read(join(home, "jobs", job.id, name)) ?? ""), ["", "400M", "AC0001", "", ""]);
	writeFileSync(gate, "");
	assert.equal(await endedWith(home, job.id), "finished");
});

test("with no plugin providing jobs.limits a job's scope has no cap of its own: the joint slice is its only limit", needsManager, async () => {
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await until("the wrapper", () => read(join(home, "jobs", job.id, "pid")));
	assert.deepEqual(["CPUQuotaPerSecUSec", "MemoryMax"].map((property) => show(`arthur-job-${job.id}.scope`, property)), ["infinity", "infinity"]);
	writeFileSync(gate, "");
	assert.equal(await endedWith(home, job.id), "finished");
});

test("two plugins that provide jobs.limits refuse the spawn before anything exists", async () => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }), jobSlice, () => [{}, {}]);
	await assert.rejects(jobs.spawn({ task: "Go." }), { message: 'call("jobs.limits"): provided by 2 plugins; call needs exactly one' });
	assert.equal(existsSync(join(home, "jobs")), false);
});

test("a job over its memory cap ends limit: memory, and another job with a cap keeps running", needsManager, async () => {
	const gate = join(temporaryFolder(), "gate");
	const { agent, on } = hogging(640, { steps: [{ waitFor: gate }, { message: "Done." }] });
	const { home, jobs } = setup(agent, jobSlice, () => [{ memory: "300M" }]);
	writeFileSync(on, "");
	const hog = await jobs.spawn({ task: "Hog." });
	const other = await jobs.spawn({ task: "Go." });
	// The wrapper stops the agent at its next sample, or the kernel killed the agent as well (it scores 1000): either is the cap.
	assert.equal(await endedWith(home, hog.id), "limit: memory: the job went over its memory cap of 300M");
	assert.equal(readFileSync(join(home, "jobs", other.id, "state"), "utf8"), "working");
	assert.ok(running(Number(read(join(home, "jobs", other.id, "pid")))), "the other job's wrapper runs on");
	writeFileSync(gate, "");
	assert.equal(await endedWith(home, other.id), "finished");
});

// The kernel kills the process of the highest score in a scope over its cap, and once killed a second one before the first one's
// memory was freed: the wrapper, so the job never ended. The agent's tree scores 1000, the most, and the wrapper its own.
test("over a memory cap the kernel takes the agent and what it started first, never the wrapper: their oom_score_adj is 1000, the wrapper's its own", needsManager, async () => {
	const gate = join(temporaryFolder(), "gate");
	const { agent, daemon } = forking({ steps: [{ waitFor: gate }, { message: "Done." }] });
	const { home, jobs } = setup(agent, jobSlice, () => [{ memory: "300M" }]);
	const job = await jobs.spawn({ task: "Go." });
	const pid = await until("the daemon", daemon);
	const wrapper = Number(read(join(home, "jobs", job.id, "pid")));
	const score = (pid: number | "self") => read(`/proc/${pid}/oom_score_adj`);
	assert.notEqual(score("self"), "1000");
	// The agent may fork the daemon before the wrapper, starved of CPU, has put its own score back.
	await until("the wrapper's own score back", () => score(wrapper) === score("self"));
	assert.equal(score(pid), "1000");
	writeFileSync(gate, "");
	assert.equal(await endedWith(home, job.id), "finished");
});

test("without a user manager a job over its memory cap is stopped within one 10 s sample, and the machine is told once", async (t) => {
	noManager(t);
	const gate = join(temporaryFolder(), "gate");
	const { agent, on, hog } = hogging(640, { steps: [{ waitFor: gate }, { message: "Done." }] });
	const { home, jobs } = setup(agent, jobSlice, () => [{ cpu: 1, memory: "300M" }]);
	writeFileSync(on, "");
	const job = await jobs.spawn({ task: "Hog." });
	const pid = Number(await until("the hog holding its memory", () => read(hog)));
	const held = Date.now();
	assert.equal(await endedWith(home, job.id), "limit: memory: the job went over its memory cap of 300M");
	assert.ok(Date.now() - held < 12_000, `stopped ${Date.now() - held} ms after it held the memory`);
	assert.equal(running(pid), false, "the hog is stopped with the agent");
	writeFileSync(gate, "");
	const next = await jobs.spawn({ task: "Go." });
	assert.equal(await endedWith(home, next.id), "finished");
	const notices = readEvents(home, 1).filter((event) => event.name === "notice").map((event) => event.data);
	assert.equal(notices.length, 1, JSON.stringify(notices));
	assert.match(JSON.stringify(notices[0]), /^\{"text":"machine local runs jobs without a systemd scope \(.+\): a job's memory cap there is held by sampling its processes every 10 s, its CPU is not capped, and a ticket's CPU and memory caps, shared by all its jobs, are not held"\}$/);
});

test("a systemd older than 253, which takes no OOMPolicy on a scope, gets the memory cap without it", async (t) => {
	const args = join(temporaryFolder(), "args");
	onPath(t, { systemctl: '[ "$1" = --version ] && echo "systemd 249 (249.11-0ubuntu3)"; exit 0', "systemd-run": `printf '%s\\n' "$@" > '${args}'; exit 1` });
	const { jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }), jobSlice, () => [{ memory: "300M" }]);
	await jobs.spawn({ task: "Go." });
	const given = readFileSync(args, "utf8").split("\n");
	assert.deepEqual(given.slice(given.indexOf("-p"), given.indexOf("--")), ["-p", "MemoryMax=300M", "-p", "MemorySwapMax=0"]);
});

test("a job with its ticket's memory cap and none of its own gets OOMPolicy continue from systemd 253 on, so a kill over the ticket's cap leaves its wrapper", async (t) => {
	const args = join(temporaryFolder(), "args");
	onPath(t, { systemctl: '[ "$1" = --version ] && echo "systemd 255 (255.4-1ubuntu8)"; exit 0', "systemd-run": `printf '%s\\n' "$@" > '${args}'; exit 1` });
	const { jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }), jobSlice, () => [{ feature: { name: "AC0001", memory: "300M" } }]);
	await jobs.spawn({ task: "Go." });
	const given = readFileSync(args, "utf8").split("\n");
	assert.deepEqual(given.slice(given.indexOf("-p"), given.indexOf("--")), ["-p", "OOMPolicy=continue"]);
});

test("a job over its ticket's memory cap ends limit: memory naming the ticket, and the ticket's other job, whose process was not killed, runs on", needsManager, async () => {
	const gate = join(temporaryFolder(), "gate");
	const { agent, on, starts } = hogging(640, { steps: [{ waitFor: gate }, { message: "Done." }] });
	const { home, jobs } = setup(agent, jobSlice, () => [{ memory: "1G", feature: { name: "AC0001", memory: "400M" } }]);
	const other = await jobs.spawn({ task: "Go." });
	const started = await until("the other job's agent", () => read(starts));
	// The other job's agent is no candidate before the hog's job: the hog and its agent score 1000, it scores this process's own.
	assert.equal(read(`/proc/${(JSON.parse(started) as { readonly pid: number }).pid}/oom_score_adj`), read("/proc/self/oom_score_adj"));
	writeFileSync(on, "");
	const hog = await jobs.spawn({ task: "Hog." });
	assert.equal(await endedWith(home, hog.id), "limit: memory: the jobs of ticket AC0001 went over their memory cap of 400M");
	// Its end says it ran on: a job of the ticket that the slice's cap ended would end limit: memory.
	writeFileSync(gate, "");
	assert.equal(await endedWith(home, other.id), "finished");
});

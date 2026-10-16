import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { loadConfig } from "../src/config.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import type { Slice } from "../src/job-scope.ts";
import { jobRunner } from "../src/jobs.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

// Every job here runs in the kit's slice, `jobSlice`, never Arthur's own, and the kit removes it when the process exits.
const manager = spawnSync("systemctl", ["--user", "show-environment"]).status === 0;
const needsManager = { skip: !manager && "no systemd user manager" };
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const show = (unit: string, property: string) => execFileSync("systemctl", ["--user", "show", unit, "-p", property, "--value"], { encoding: "utf8" }).trim();

// A repository `acme`, a home folder beside it, and a runner whose agent is `agent`, its jobs in `slice`.
function setup(agent: string, slice: Slice = jobSlice) {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const home = join(folder, "home");
	const time = clock("UTC", undefined, () => new Date("2026-10-16T08:00:00Z"));
	return { home, jobs: jobRunner(home, root, { timeoutMinutes: 120, budgetUsd: 2, ...slice }, agent, time, eventBus(home), () => []) };
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
	assert.deepEqual((await ended(home)).data, { id: job.id, kind: "worker", project: "acme", state: "done", reason: "the agent exited 0" });
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
	assert.equal(readFileSync(join(home, "jobs", job.id, "state"), "utf8"), "done");
	assert.deepEqual(event.data, { id: job.id, kind: "worker", project: "acme", state: "done", reason: "the agent exited 0" });
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

test("without a user manager the job runs bare, its log saying so in one line, and ends as usual", async (t) => {
	const saved = { XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS };
	t.after(() => Object.assign(process.env, saved));
	// No bus to reach: as in a container, and as on macOS, where `systemctl` is missing.
	process.env.XDG_RUNTIME_DIR = temporaryFolder();
	delete process.env.DBUS_SESSION_BUS_ADDRESS;
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	const wrapper = Number(await until("the wrapper's pid", () => read(join(home, "jobs", job.id, "pid"))));
	if (existsSync("/proc")) assert.doesNotMatch(cgroup(wrapper) ?? "", /arthur-job-/);
	writeFileSync(gate, "");
	assert.deepEqual((await ended(home)).data, { id: job.id, kind: "worker", project: "acme", state: "done", reason: "the agent exited 0" });
	const log = readFileSync(join(home, "jobs", job.id, "log"), "utf8");
	const line = /^\[arthur [^\]]+\] no systemd scope: [^\n]+; the job runs bare, without the joint limit of core\.jobs\.cpu and core\.jobs\.memory, and what it leaves behind is not killed at its end\n\[arthur [^\]]+\] agent: /;
	assert.match(log, line);
	assert.equal(log.match(/no systemd scope/g)?.length, 1, log);
});

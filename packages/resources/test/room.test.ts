import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { loadConfig } from "@arthur/core";
import { everyOption, type OptionTable } from "@arthur/core/option-table";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { table } from "../src/resource-options.ts";
import { type ResourcesOptions, resources } from "../src/resources.ts";
import { roomOf } from "../src/room.ts";

const GB = 2 ** 30;
const CORES = os.availableParallelism();
const NOW = new Date("2026-10-18T10:00:00Z");

// The fake `ssh` on PATH, for this file: each call noted in `ssh.log`; on host `<host>` it prints `<machines>/<host>/free.json`,
// as `node -e` there would, or, when `<machines>/<host>/fail` exists, ssh's own line from it on stderr and exit code 255.
const bin = temporaryFolder();
const machines = temporaryFolder();
const sshLog = join(bin, "ssh.log");
writeFileSync(
	join(bin, "ssh"),
	`#!/bin/sh
printf '%s\\n' "$*" >> '${sshLog}'
while [ $# -gt 0 ]; do case "$1" in -o) shift 2;; -*) shift;; *) break;; esac; done
there='${machines}'/"$1"
if [ -e "$there/fail" ]; then cat "$there/fail" >&2; exit 255; fi
cat "$there/free.json"
`,
	{ mode: 0o755 },
);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
const sshCalls = () => (existsSync(sshLog) ? readFileSync(sshLog, "utf8").trim().split("\n").length : 0);

// Machine `host` answers this free CPU and memory, on 8 cores and 16 GB; `fail` makes ssh fail with that line instead.
function gpu(freeCores: number, freeBytes: number, fail?: string): void {
	const there = join(machines, "gpu");
	rmSync(there, { recursive: true, force: true });
	mkdirSync(there, { recursive: true });
	writeFileSync(join(there, "free.json"), `${JSON.stringify({ cores: 8, load: 8 - freeCores, free: freeBytes, total: 16 * GB })}\n`);
	if (fail !== undefined) writeFileSync(join(there, "fail"), `${fail}\n`);
}

// `local` answers this free CPU and memory through Node's `os`, until the test ends.
function local(t: TestContext, freeCores: number, freeBytes: number): void {
	t.mock.method(os, "loadavg", () => [CORES - freeCores, 0, 0]);
	t.mock.method(os, "freemem", () => freeBytes);
	syncBuiltinESMExports();
	t.after(() => {
		t.mock.restoreAll();
		syncBuiltinESMExports();
	});
}

// A job reserves 1 GB and half a core; 1 GB and half a core stay free.
const OPTIONS: ResourcesOptions = { perJob: { cpu: 0.5, memory: "1G" }, keepFree: { cpu: 0.5, memory: "1G" } };

// The plugin on a fake host over a repository of one commit, with the machine `gpu` registered, its clock at NOW, and `omp`
// the fake agent that waits until the test releases it.
async function load(t: TestContext, options: ResourcesOptions = OPTIONS) {
	rmSync(sshLog, { force: true });
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"]);
	const gate = join(temporaryFolder(), "gate");
	const saved = process.env.PATH;
	process.env.PATH = [dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] })), saved].join(delimiter);
	const release = () => writeFileSync(gate, "");
	t.after(() => {
		release();
		process.env.PATH = saved;
	});
	const plugin = resources(options);
	const fake = fakeHost({ name: "resources", options, root, now: NOW });
	fake.host.jobs.registerMachine({ name: "gpu", ssh: "gpu", home: "/home/arthur/.arthur", labels: {} });
	await fake.setup(plugin);
	const home = dirname(fake.host.folder);
	const records = () => (existsSync(join(home, "jobs")) ? readdirSync(join(home, "jobs")) : []);
	const notices = () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text);
	return { fake, plugin, home, release, records, notices };
}

async function until(what: string, holds: () => boolean, ms = 20_000): Promise<void> {
	for (const start = Date.now(); !holds(); await sleep(20)) if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
}

const sample = (cores: number, load: number, free: number, total = 16 * GB) => ({ at: NOW.toISOString(), jobs: [], cores, load, free, total });

test("keepFree takes cpu, 0 or more cores, and memory in bytes or a percentage; anything else is refused at load", async () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), "export default { core: {} };\n");
	const core = (await loadConfig(join(folder, "arthur.config.ts"))).core;
	const check = (keepFree: unknown) => resources({}).check?.({ keepFree } as ResourcesOptions, core);
	assert.deepEqual(check({ cpu: 0, memory: "512M" }), []);
	assert.deepEqual(check({ cpu: 1.5, memory: "10%" }), []);
	assert.deepEqual(check({ cpu: -1, memory: "infinity", disk: "20G" }), [
		{ path: "keepFree.disk", problem: "unknown key; keys: cpu, memory" },
		{ path: "keepFree.cpu", problem: "expected a number of cores, 0 or more, got -1" },
		{ path: "keepFree.memory", problem: 'expected bytes with K, M, G or T ("2G") or a percentage of the machine\'s memory ("10%"), got "infinity"' },
	]);
	assert.deepEqual(check({ memory: 2 }), [{ path: "keepFree.memory", problem: 'expected bytes with K, M, G or T ("2G") or a percentage of the machine\'s memory ("10%"), got 2' }]);
	assert.deepEqual(check([]), [{ path: "keepFree", problem: "expected an object with cpu, memory, got a list" }]);
});

test("the room: what is free less keepFree, in whole perJob reservations; one exactly equal to what is left fits, a byte or a thousandth of a core less does not", () => {
	const job = { cpu: 2, memory: "2G" };
	const keep = { cpu: 1, memory: "2G" };
	assert.deepEqual(roomOf("local", sample(8, 3, 6 * GB), 0, job, keep), { jobs: 2, line: "local: room for 2 more jobs (6.0 GB, 5.0 cores free)" });
	assert.equal(roomOf("local", sample(8, 5, 4 * GB), 0, job, keep).jobs, 1, "exactly one reservation left, on both");
	assert.deepEqual(roomOf("local", sample(8, 5, 4 * GB - 1), 0, job, keep), {
		jobs: 0,
		line: "local: no room, short of 0.1 GB memory (4.0 GB, 3.0 cores free; keepFree 2.0 GB, 1.0 cores; a job reserves 2.0 GB, 2.0 cores)",
	});
	assert.deepEqual(roomOf("local", sample(8, 5.001, 4 * GB), 0, job, keep).line, "local: no room, short of 0.1 cores (4.0 GB, 3.0 cores free; keepFree 2.0 GB, 1.0 cores; a job reserves 2.0 GB, 2.0 cores)");
	assert.deepEqual(roomOf("local", sample(8, 3, 6 * GB), 1, job, keep), { jobs: 1, line: "local: room for 1 more job (4.0 GB, 3.0 cores free)" }, "a job started since the check, at its reservation");
	assert.equal(
		roomOf("local", sample(8, 3, 6 * GB), 2, job, keep).line,
		"local: no room, short of 2.0 GB memory and 2.0 cores (2.0 GB, 1.0 cores free; keepFree 2.0 GB, 1.0 cores; a job reserves 2.0 GB, 2.0 cores; reserved for 2 jobs started since the check)",
	);
	assert.equal(roomOf("small", sample(2, 0, 8 * GB), 0, { cpu: 4 }, {}).jobs, 1, "a cpu above the machine's cores reserves its cores");
	assert.equal(roomOf("local", sample(8, 9, 8 * GB), 0, {}, {}).jobs, Infinity, "no reservation, no floor: room for any number, a load above the cores counting as none free");
	assert.equal(roomOf("local", sample(8, 0, 8 * GB), 0, { memory: "infinity" }, { memory: "8G" }).line, "local: room for any number of jobs, perJob reserving nothing (8.0 GB, 8.0 cores free)");
	assert.deepEqual(roomOf("local", sample(8, 0, 1 * GB), 0, {}, { memory: "2G" }).line, "local: no room, short of 1.0 GB memory (1.0 GB, 8.0 cores free; keepFree 2.0 GB, 0.0 cores; a job reserves 0.0 GB, 0.0 cores)");
	assert.equal(roomOf("gpu", sample(8, 0, 8 * GB), 0, { memory: "25%" }, {}).jobs, 2, "a percentage of the machine's own memory: 4 GB of 16");
	assert.deepEqual(roomOf("gpu", { at: NOW.toISOString(), jobs: [], error: "ssh failed: refused" }, 0, job, keep), { jobs: 0, line: "gpu: no room, its check failed: ssh failed: refused" });
	assert.deepEqual(roomOf("gpu", undefined, 0, job, keep), { jobs: 0, line: "gpu: no room, not checked yet" });
});

test("every spawn is refused while no machine has room, naming each machine and its shortfall, before any record exists", async (t) => {
	local(t, 0.75, 1.5 * GB);
	gpu(0.5, 3 * GB);
	const { fake, records } = await load(t);
	const machines =
		"local: no room, short of 0.5 GB memory and 0.3 cores (1.5 GB, 0.8 cores free; keepFree 1.0 GB, 0.5 cores; a job reserves 1.0 GB, 0.5 cores); " +
		"gpu: no room, short of 0.5 cores (3.0 GB, 0.5 cores free; keepFree 1.0 GB, 0.5 cores; a job reserves 1.0 GB, 0.5 cores)";
	await assert.rejects(fake.host.jobs.spawn({ task: "Go." }), { message: `refused by resources: no room on local for another job: ${machines}; spawn again once a job ends` });
	await assert.rejects(fake.host.jobs.spawn({ task: "Go.", machine: "gpu" }), { message: `refused by resources: no room on gpu for another job: ${machines}; spawn again once a job ends` });
	assert.deepEqual(records(), []);
});

test("a reservation exactly equal to what is left starts; two spawns at once never both take the last room; a job's end frees it", async (t) => {
	local(t, 1, 2 * GB);
	gpu(0, 0);
	const { fake, release, records } = await load(t);
	const [one, two] = await Promise.allSettled([fake.host.jobs.spawn({ task: "One." }), fake.host.jobs.spawn({ task: "Two." })]);
	const started = [one, two].flatMap((each) => (each.status === "fulfilled" ? [each.value.id] : []));
	const refused = [one, two].flatMap((each) => (each.status === "rejected" ? [String(each.reason)] : []));
	assert.equal(started.length, 1, refused.join("\n"));
	assert.match(refused[0] ?? "", /^Error: refused by resources: no room on local for another job: local: no room, short of 1\.0 GB memory and 0\.5 cores \(1\.0 GB, 0\.5 cores free; .*; reserved for 1 job started since the check\); gpu: /);
	assert.deepEqual(records(), started);
	release();
	await until("the job's end", () => fake.host.jobs.list().every((job) => job.state === "ended"));
	await fake.host.jobs.spawn({ task: "Three." });
	assert.equal(records().length, 2);
});

test("a machine whose check fails has no room, said once until a check answers; a check under 2 minutes old is not made again", async (t) => {
	local(t, 1, 2 * GB);
	gpu(4, 8 * GB, "ssh: connect to host gpu port 22: Connection refused");
	const { fake, notices } = await load(t);
	const free = (name: string) => fake.call<Promise<number>>("resources.free", name);
	const said = "machine gpu: its free CPU and memory are unknown (ssh failed: ssh: connect to host gpu port 22: Connection refused); no job starts there until a check answers";
	assert.equal(await free("gpu"), 0);
	assert.deepEqual(notices(), [said]);
	fake.setNow(new Date(NOW.getTime() + 119_000));
	assert.equal(await free("gpu"), 0);
	assert.equal(sshCalls(), 1, "the check of 119 s ago is read, not made again");
	fake.setNow(new Date(NOW.getTime() + 120_000));
	assert.equal(await free("gpu"), 0);
	assert.equal(sshCalls(), 2, "one 120 s old is made again");
	assert.deepEqual(notices(), [said], "a failure after a failure is not said again");
	gpu(4, 8 * GB);
	fake.setNow(new Date(NOW.getTime() + 240_000));
	assert.equal(await free("gpu"), 7, "8 GB less 1 kept is 7 reservations of 1 GB; 3.5 cores of 0.5 is 7");
	assert.equal(await free("local"), 1);
	gpu(4, 8 * GB, "Host key verification failed.");
	fake.setNow(new Date(NOW.getTime() + 360_000));
	assert.equal(await free("gpu"), 0);
	assert.deepEqual(notices(), [said, "machine gpu: its free CPU and memory are unknown (ssh failed: Host key verification failed.); no job starts there until a check answers"]);
	writeFileSync(join(fake.host.folder, "machines", "gpu.json"), "{ broken");
	gpu(1, 2 * GB, "\n");
	rmSync(join(machines, "gpu", "fail"));
	assert.equal(await free("gpu"), 1, "a broken file is checked anew");
});

test("another machine that answers no numbers, or whose node is missing, has no room", async (t) => {
	gpu(1, 2 * GB);
	const { fake } = await load(t);
	writeFileSync(join(machines, "gpu", "free.json"), '{ "cores": 8, "load": "high" }\n');
	assert.equal(await fake.call<Promise<number>>("resources.free", "gpu"), 0);
	assert.equal(fake.collect<string>("coordinator.context")[0]?.split("\n")[1], 'gpu: no room, its check failed: node -e answered "{ \\"cores\\": 8, \\"load\\": \\"high\\" }", not cores, load and memory');
});

test("the coordinator's context, arthur resources and /resources show one line per machine; arthur run checks each at its start", async (t) => {
	local(t, 1, 3 * GB);
	gpu(2, 1 * GB);
	const { fake, plugin } = await load(t);
	assert.deepEqual(fake.collect<string>("coordinator.context"), ["local: no room, not checked yet\ngpu: no room, not checked yet"], "the context only reads");
	assert.equal(sshCalls(), 0);
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	await until("both checked", () => existsSync(join(fake.host.folder, "machines", "local.json")) && existsSync(join(fake.host.folder, "machines", "gpu.json")));
	const lines = "local: room for 1 more job (3.0 GB, 1.0 cores free)\ngpu: no room, short of 1.0 GB memory (1.0 GB, 2.0 cores free; keepFree 1.0 GB, 0.5 cores; a job reserves 1.0 GB, 0.5 cores)";
	assert.deepEqual(fake.collect<string>("coordinator.context"), [lines]);
	assert.equal(await fake.host.commands.route("/resources"), lines);
	assert.equal(await fake.host.commands.route("/resources AC0001"), "usage: /resources");
	const command = fake.commands.find((each) => each.name === "resources");
	const log = t.mock.method(console, "log", () => {});
	const error = t.mock.method(console, "error", () => {});
	assert.equal(await command?.run({ args: [], project: undefined }), undefined);
	assert.deepEqual(log.mock.calls.map((call) => call.arguments), [[lines]]);
	assert.equal(await command?.run({ args: ["AC0001", "more"], project: undefined }), 2);
	assert.deepEqual(error.mock.calls.map((call) => call.arguments), [["usage: arthur resources [<ticket id>]"]]);
});

// Each default `table` writes as a value, by its path, parsed as JSON when it parses; `words` are the paths of those written as
// words for a person, left out.
function valueDefaults(table: OptionTable, words: readonly string[]): Record<string, unknown> {
	const value = (text: string): unknown => {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	};
	return Object.fromEntries(everyOption(table).flatMap(({ path, entry }) => (entry.default === undefined || words.includes(path) ? [] : [[path, value(entry.default)]])));
}

test("each default the option table writes as a value is the one the code applies with nothing set", () => {
	const caps = ["perJob.cpu", "perJob.memory", "perFeature.budgetUsd", "perFeature.hours", "perFeature.cpu", "perFeature.memory"];
	const defaults = valueDefaults(table, [...caps, "keepFree.memory"]);
	assert.deepEqual(Object.keys(defaults), ["keepFree.cpu"]);
	// Four free cores, a core per job: the room left out of keepFree is the room with its cpu at the table's default, and a core more kept free is one job less.
	const room = (keepFree: { cpu?: number }) => roomOf("local", sample(4, 0, 8 * GB), 0, { cpu: 1 }, keepFree).jobs;
	assert.deepEqual([room({}), room({ cpu: defaults["keepFree.cpu"] as number }), room({ cpu: 1 })], [4, 4, 3]);
});

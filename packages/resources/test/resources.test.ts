import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os, { availableParallelism } from "node:os";
import { syncBuiltinESMExports } from "node:module";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { loadConfig } from "@arthur/core";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type ResourcesOptions, resources } from "../src/resources.ts";

const manager = spawnSync("systemctl", ["--user", "show-environment"]).status === 0;

// The core's options as `arthur.config.ts` with `jobs` loads them, defaults applied.
async function core(jobs: Readonly<Record<string, unknown>> = {}) {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), `export default { core: { jobs: ${JSON.stringify(jobs)} } };\n`);
	return (await loadConfig(join(folder, "arthur.config.ts"))).core;
}

const check = async (options: ResourcesOptions, jobs?: Readonly<Record<string, unknown>>) => resources(options).check?.(options, await core(jobs));

test("a per-job cap above the joint core.jobs.cpu or core.jobs.memory is refused at load, naming the option; one at it passes", async () => {
	assert.deepEqual(await check({ perJob: { cpu: 4, memory: "8G" } }, { cpu: 3, memory: "6G" }), [
		{ path: "perJob.cpu", problem: "4 is above core.jobs.cpu, 3, the cores of all jobs together" },
		{ path: "perJob.memory", problem: "8G is above core.jobs.memory, 6G, the memory of all jobs together" },
	]);
	assert.deepEqual(await check({ perJob: { cpu: 3, memory: "6G" } }, { cpu: 3, memory: "6G" }), []);
	assert.deepEqual(await check({ perJob: { memory: "6145M" } }, { memory: "6G" }), [{ path: "perJob.memory", problem: "6145M is above core.jobs.memory, 6G, the memory of all jobs together" }]);
	// Left out, the joint limit is this host's cores minus one and 70% of its memory.
	assert.deepEqual(await check({ perJob: { cpu: Math.max(1, availableParallelism() - 1), memory: "70%" } }), []);
	assert.deepEqual(await check({ perJob: { cpu: Math.max(1, availableParallelism() - 1) + 0.5, memory: "70.01%" } }), [
		{ path: "perJob.cpu", problem: `${Math.max(1, availableParallelism() - 1) + 0.5} is above core.jobs.cpu, ${Math.max(1, availableParallelism() - 1)}, the cores of all jobs together` },
		{ path: "perJob.memory", problem: "70.01% is above core.jobs.memory, 70%, the memory of all jobs together" },
	]);
	assert.deepEqual(await check({ perJob: { memory: "infinity" } }), [{ path: "perJob.memory", problem: "infinity is above core.jobs.memory, 70%, the memory of all jobs together" }]);
	assert.deepEqual(await check({ perJob: { memory: "infinity" } }, { memory: "infinity" }), []);
});

test("options it does not take, and values systemd would refuse, are refused at load", async () => {
	const given = { perJob: { cpu: 0, memory: "4 GB", disk: "1G" }, keepDisk: "20G" } as unknown as ResourcesOptions;
	assert.deepEqual(await check(given), [
		{ path: "keepDisk", problem: "unknown option; options: perJob, perFeature, keepFree" },
		{ path: "perJob.disk", problem: "unknown key; keys: cpu, memory" },
		{ path: "perJob.cpu", problem: "expected a number of cores above 0, got 0" },
		{ path: "perJob.memory", problem: 'expected systemd MemoryMax syntax such as "4G", "25%" or "infinity", got "4 GB"' },
	]);
	assert.deepEqual(await check({ perJob: [] } as unknown as ResourcesOptions), [{ path: "perJob", problem: "expected an object with cpu, memory, got a list" }]);
	assert.deepEqual(await check({}), []);
});

test("jobs.limits answers perJob's caps for every job, and nothing for one left out", async () => {
	const capped = fakeHost({ name: "resources", options: { perJob: { cpu: 2, memory: "4G" } } });
	await capped.setup(resources({ perJob: { cpu: 2, memory: "4G" } }));
	assert.deepEqual(capped.provided, ["jobs.limits", "resources.free", "machines.round", "coordinator.context"]);
	assert.deepEqual(capped.call("jobs.limits", { task: "Go.", machine: "local", tickets: [] }), { cpu: 2, memory: "4G" });
	const bare = fakeHost({ name: "resources", options: { perJob: { memory: "1G" } } });
	await bare.setup(resources({ perJob: { memory: "1G" } }));
	assert.deepEqual(bare.call("jobs.limits", { tickets: [] }), { memory: "1G" });
	const none = fakeHost({ name: "resources" });
	await none.setup(resources({}));
	assert.deepEqual(none.call("jobs.limits", { tickets: [] }), {});
});

test("a job spawned with the plugin gets its caps on its own scope, in the test kit's slice", { skip: !manager && "no systemd user manager" }, async (t) => {
	const root = temporaryFolder();
	const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
	git("init", "--quiet", "--initial-branch=main");
	git("-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first");
	const gate = join(temporaryFolder(), "gate");
	const saved = process.env.PATH;
	t.after(() => void (process.env.PATH = saved));
	process.env.PATH = [dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] })), saved].join(delimiter);
	const options = { perJob: { cpu: 1.5, memory: "512M" } };
	// Room for the job on this host however busy it is: no CPU time in use, 64 GB free.
	t.mock.method(os, "cpus", () => [{ model: "fake", speed: 1000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }]);
	t.mock.method(os, "freemem", () => 64 * 2 ** 30);
	syncBuiltinESMExports();
	t.after(() => {
		t.mock.restoreAll();
		syncBuiltinESMExports();
	});
	const fake = fakeHost({ name: "resources", options, root });
	await fake.setup(resources(options));
	const job = await fake.host.jobs.spawn({ task: "Go." });
	const record = join(dirname(fake.host.folder), "jobs", job.id);
	for (const start = Date.now(); !existsSync(join(record, "pid")); await sleep(20)) assert.ok(Date.now() - start < 10_000, "the wrapper's pid");
	const show = (property: string) => execFileSync("systemctl", ["--user", "show", `arthur-job-${job.id}.scope`, "-p", property, "--value"], { encoding: "utf8" }).trim();
	assert.match(execFileSync("systemctl", ["--user", "show", `arthur-job-${job.id}.scope`, "-p", "Slice", "--value"], { encoding: "utf8" }), /^arthur_test_/);
	// The core caps a job's CPU at the machine's cores: 1.5 cores on two or more, 1 on one.
	assert.deepEqual([show("CPUQuotaPerSecUSec"), show("MemoryMax")], [availableParallelism() >= 2 ? "1.500000s" : "1s", String(512 * 2 ** 20)]);
	writeFileSync(gate, "");
	for (const start = Date.now(); readFileSync(join(record, "state"), "utf8") !== "ended"; await sleep(20)) assert.ok(Date.now() - start < 10_000, "the job's end");
	assert.equal(readFileSync(join(record, "reason"), "utf8"), "finished");
});

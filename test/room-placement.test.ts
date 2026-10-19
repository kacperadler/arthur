import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { coreVersion } from "@arthur/core";
import type { Plugin } from "@arthur/core/plugin";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { machines } from "@arthur/machines";
import { orchestration } from "@arthur/orchestration";
import { resources } from "@arthur/resources";

// Roadmap entry 34 with the plugins it works with, on one fake host: the machines plugin's placement reads the resources
// plugin's `resources.free` as the jobs a machine has room for (F2 of AR0125), and orchestration's `maxAgents` still refuses
// above that room. A plugin's own tests never load another plugin; this one, outside every package, loads three.

const GB = 2 ** 30;
const NOW = new Date("2026-10-18T10:00:00Z");

// The fake `ssh` on PATH: `-G` prints a private address; on `gpu` the machines plugin's check gets Linux and this core's
// version, and the resources plugin's `node -e` the numbers in `<machines>/gpu/free.json`.
const bin = temporaryFolder();
const there = join(temporaryFolder(), "gpu");
mkdirSync(there);
writeFileSync(
	join(bin, "ssh"),
	`#!/bin/sh
if [ "$1" = -G ]; then printf 'host %s\\nhostname 127.0.0.1\\n' "$2"; exit 0; fi
case "$*" in
  *uname*) printf 'Linux x86_64\\n%s\\n' '${coreVersion()}';;
  *node*) cat '${there}/free.json';;
  *) echo "unexpected: $*" >&2; exit 1;;
esac
`,
	{ mode: 0o755 },
);
const gpu = (freeBytes: number) => writeFileSync(join(there, "free.json"), JSON.stringify({ cores: 8, load: 4, free: freeBytes, total: 16 * GB }));

// A job reserves 1 GB and a tenth of a core; 1 GB and a tenth of a core stay free. `local` has 1 core free and `freeBytes`.
const OPTIONS = { perJob: { cpu: 0.1, memory: "1G" }, keepFree: { cpu: 0.1, memory: "1G" } };

async function load(t: TestContext, maxAgents: number) {
	const saved = process.env.PATH;
	const gate = join(temporaryFolder(), "gate");
	process.env.PATH = [bin, dirname(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] })), saved].join(delimiter);
	let localFree = 0;
	t.mock.method(os, "cpus", () => [{ model: "fake", speed: 1000, times: { user: (os.availableParallelism() - 1) * performance.now(), nice: 0, sys: 0, idle: 0, irq: 0 } }]);
	t.mock.method(os, "freemem", () => localFree);
	syncBuiltinESMExports();
	t.after(() => {
		writeFileSync(gate, "");
		process.env.PATH = saved;
		t.mock.restoreAll();
		syncBuiltinESMExports();
	});
	const root = temporaryFolder();
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "first"]);
	const fake = fakeHost({ name: "resources", root, now: NOW });
	const list = [{ name: "gpu", ssh: "gpu", home: "/home/arthur/.arthur", labels: { os: "linux", arch: "x64" } }];
	const plugins: [Plugin, Readonly<Record<string, unknown>>][] = [[machines({ list }), { list }], [resources(OPTIONS), OPTIONS], [orchestration({ maxAgents }), { maxAgents }]];
	for (const [plugin, options] of plugins) await fake.setup({ setup: (host) => plugin.setup({ ...host, options }) });
	const home = dirname(fake.host.folder);
	// A job in a run on `local`, as the core's runner leaves its record.
	const folder = join(home, "jobs", "2026-10-18-worker-0000000a");
	mkdirSync(folder, { recursive: true });
	for (const [name, text] of Object.entries({ kind: "worker", project: "acme", machine: "local", state: "working", since: NOW.toISOString() })) writeFileSync(join(folder, name), text);
	const asked = { task: "Go.", kind: "worker", project: "acme", model: undefined, thinking: undefined, quick: undefined, timeoutMinutes: 120, budgetUsd: 2, tickets: [], machine: undefined, requires: undefined };
	return {
		fake,
		setLocal: (bytes: number) => void (localFree = bytes),
		place: () => fake.call<Promise<string>>("jobs.place", asked),
		free: (name: string) => fake.call<Promise<number>>("resources.free", name),
		// The checks kept are thrown away, so the next asks check again.
		forget: (...names: string[]) => { for (const name of names) rmSync(join(fake.host.folder, "machines", `${name}.json`), { force: true }); },
	};
}

test("placement takes the machine with the most room as resources.free answers it, over the fewest jobs; with none anywhere the spawn is refused", async (t) => {
	const at = await load(t, 5);
	at.setLocal(4 * GB);
	gpu(2 * GB);
	assert.deepEqual([await at.free("local"), await at.free("gpu")], [3, 1]);
	const job = await at.fake.host.jobs.spawn({ task: "Go." });
	assert.equal(job.machine, "local", "local's 3 jobs of room over gpu's 1, though gpu has fewer jobs in a run");
	at.forget("gpu");
	gpu(8 * GB);
	assert.deepEqual([await at.free("local"), await at.free("gpu")], [2, 7], "local: the job started since the check counts at its reservation");
	assert.equal(await at.place(), "gpu");
	at.forget("local", "gpu");
	at.setLocal(1 * GB);
	gpu(1 * GB);
	await assert.rejects(at.fake.host.jobs.spawn({ task: "Go." }), {
		message: /^refused by resources: no room on local for another job: local: no room, short of 1\.0 GB memory .*; gpu: no room, short of 1\.0 GB memory .*; spawn again once a job ends$/,
	});
});

test("room for more jobs than maxAgents: maxAgents refuses", async (t) => {
	const at = await load(t, 1);
	at.setLocal(8 * GB);
	gpu(8 * GB);
	assert.equal(await at.free("local"), 7);
	await assert.rejects(at.fake.host.jobs.spawn({ task: "Go." }), {
		// One host carries all three, so every refusal names it, resources; the words are orchestration's.
		message: "refused by resources: maxAgents is 1 and 1 job is in a run: 2026-10-18-worker-0000000a; spawn again once one ends",
	});
});

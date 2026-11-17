import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import { cpus } from "./cpus.ts";

const SCOPE = "/user.slice/arthur-jobs.slice/arthur-job-1.scope";

// A /proc/self/cgroup and a cgroup v2 mount in a temporary folder: `limits` maps a cgroup's path to its cpu.max, as the kernel writes it.
function machine(cgroup: string | undefined, limits: Readonly<Record<string, string>>): { file: string; mount: string } {
	const folder = temporaryFolder();
	const file = join(folder, "cgroup");
	const mount = join(folder, "sys");
	if (cgroup !== undefined) writeFileSync(file, cgroup);
	for (const [path, max] of Object.entries(limits)) {
		mkdirSync(join(mount, path), { recursive: true });
		writeFileSync(join(mount, path, "cpu.max"), max);
	}
	return { file, mount };
}

const count = (cgroup: string | undefined, limits: Readonly<Record<string, string>>, cores: number) => {
	const { file, mount } = machine(cgroup, limits);
	return cpus(file, mount, cores);
};

test("a job's scope allows 3 CPUs on 11 cores: 3, the tightest cpu.max of the scope and every cgroup above it, a whole CPU at least", () => {
	assert.equal(count(`0::${SCOPE}\n`, { [SCOPE]: "300000 100000\n", "/user.slice/arthur-jobs.slice": "1100000 100000\n" }, 11), 3);
	assert.equal(count(`0::${SCOPE}\n`, { [SCOPE]: "max 100000\n", "/user.slice/arthur-jobs.slice": "200000 100000\n" }, 11), 2);
	assert.equal(count(`0::${SCOPE}\n`, { [SCOPE]: "max 100000\n", "/": "400000 100000\n" }, 11), 4);
	assert.equal(count(`0::${SCOPE}\n`, { [SCOPE]: "250000 100000\n" }, 11), 2);
	assert.equal(count(`0::${SCOPE}\n`, { [SCOPE]: "50000 100000\n" }, 11), 1);
});

test("no cpu.max under the cores, none at all, a broken one, cgroup v1 or no /proc: every core", () => {
	assert.equal(count(`0::${SCOPE}\n`, { [SCOPE]: "800000 100000\n" }, 4), 4);
	assert.equal(count(`0::${SCOPE}\n`, { [SCOPE]: "max 100000\n" }, 4), 4);
	assert.equal(count(`0::${SCOPE}\n`, {}, 4), 4);
	assert.equal(count(`0::${SCOPE}\n`, { [SCOPE]: "300000\n" }, 4), 4);
	assert.equal(count(`4:cpu,cpuacct:${SCOPE}\n`, { [SCOPE]: "300000 100000\n" }, 4), 4);
	assert.equal(count(undefined, { "/": "300000 100000\n" }, 4), 4);
});

test("a container's own cgroup, 0::/, and a hybrid machine's line among v1 ones are read too", () => {
	assert.equal(count("0::/\n", { "/": "200000 100000\n" }, 8), 2);
	assert.equal(count(`5:cpu:/other\n0::${SCOPE}\n1:name=systemd:/\n`, { [SCOPE]: "300000 100000\n" }, 8), 3);
});

test("node test/cpus.ts, as npm test runs it, prints that count of this process alone", () => {
	const ran = spawnSync(process.execPath, [join(import.meta.dirname, "cpus.ts")], { encoding: "utf8" });
	assert.equal(ran.status, 0, ran.stderr);
	assert.equal(ran.stdout, `${cpus()}\n`);
});

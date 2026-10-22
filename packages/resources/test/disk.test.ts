import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { type TestContext, test } from "node:test";
import { loadConfig } from "@arthur/core";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type ResourcesOptions, resources } from "../src/resources.ts";
import { roomOf } from "../src/room.ts";

const GB = 2 ** 30;
const NOW = new Date("2026-10-21T10:00:00Z");
// The floor, 20 GB, in the KiB df answers.
const FLOOR = 20 * 2 ** 20;

// The fake `df` and `ssh` on PATH, for this file, each call noted in its log. `df -Pk <path>...` answers in POSIX `df -P`
// output from `<table>`, one row `<path>|<filesystem>|<free KiB>|<mount point>` per path, and refuses a path without one as
// df does; `<dir>/garbage` is printed instead when it exists, and `<dir>/fail` makes it fail with that line. `ssh <host>
// <command>` runs the command here, the fake df included, or fails as ssh does when `<dir>/<host>.down` exists.
const bin = temporaryFolder();
const dir = temporaryFolder();
const [dfLog, sshLog, table] = [join(bin, "df.log"), join(bin, "ssh.log"), join(dir, "table")];
writeFileSync(
	join(bin, "df"),
	`#!/bin/sh
printf '%s\\n' "$*" >> '${dfLog}'
[ "$1" = -Pk ] || { echo "df: invalid option $1" >&2; exit 1; }
shift
if [ -e '${dir}/garbage' ]; then cat '${dir}/garbage'; exit 0; fi
if [ -e '${dir}/fail' ]; then cat '${dir}/fail' >&2; exit 1; fi
echo 'Filesystem     1024-blocks      Used Available Capacity Mounted on'
for path do
	awk -F'|' -v path="$path" '$1 == path { printf "%-14s %11d %9d %9d %7d%% %s\\n", $2, $3 * 2, $3, $3, 50, $4; found = 1 } END { exit !found }' '${table}' || { echo "df: $path: No such file or directory" >&2; exit 1; }
done
`,
	{ mode: 0o755 },
);
writeFileSync(
	join(bin, "ssh"),
	`#!/bin/sh
printf '%s\\n' "$*" >> '${sshLog}'
while [ $# -gt 0 ]; do case "$1" in -o) shift 2;; -*) shift;; *) break;; esac; done
if [ -e '${dir}'/"$1.down" ]; then echo "ssh: connect to host $1 port 22: Connection refused" >&2; exit 255; fi
shift
exec sh -c "$*"
`,
	{ mode: 0o755 },
);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
const logged = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").trim().split("\n") : []);

// The fake df's filesystems from now on: each path, its filesystem, its free KiB, its mount point.
function disks(...rows: readonly (readonly [path: string, filesystem: string, free: number, mount: string])[]): void {
	writeFileSync(table, rows.map((row) => `${row.join("|")}\n`).join(""));
	for (const file of ["garbage", "fail"]) rmSync(join(dir, file), { force: true });
}

const FREE = JSON.stringify({ cores: 8, load: 0, free: 8 * GB, total: 16 * GB });

// The plugin with `options` on a fake host over a repository of one commit, with the machine `gpu` registered (its home a
// folder of the test's own, which the fake ssh reaches here), its clock at NOW, and `omp` the fake agent that waits until
// the test releases it. `round` is a machines round of a machine as the machines plugin runs it: its free CPU and memory, and
// df run on the paths the plugin's answer names, as the check's one ssh call runs it there, its errors in its output.
async function load(t: TestContext, options: ResourcesOptions) {
	for (const file of [dfLog, sshLog]) rmSync(file, { force: true });
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
	const gpu = temporaryFolder();
	const fake = fakeHost({ name: "resources", options, root, now: NOW });
	fake.host.jobs.registerMachine({ name: "gpu", ssh: "gpu", home: gpu, labels: {} });
	await fake.setup(resources(options));
	const free = (name: string) => fake.call<Promise<number>>("resources.free", name);
	const round = async (name = "gpu") => {
		const said = Promise.withResolvers<unknown>();
		const [answer] = fake.collect<Promise<ReadonlyMap<string, readonly string[]>>>("machines.round", new Map([[name, said.promise]]));
		const paths = (await answer)?.get(name) ?? [];
		const df = spawnSync("sh", ["-c", 'for path do if [ -e "$path" ]; then df -Pk "$path" || exit; else echo missing; fi; done 2>&1', "sh", ...paths], { encoding: "utf8" });
		said.resolve({ free: FREE, ...(paths.length === 0 ? {} : { disk: { code: df.status, output: df.stdout.trim() } }) });
		return free(name);
	};
	let seconds = 0;
	// Two minutes on, so the next ask checks again.
	const later = () => fake.setNow(new Date(NOW.getTime() + (seconds += 120) * 1000));
	const line = (name: string) => fake.collect<string>("coordinator.context")[0]?.split("\n").filter((each) => each.startsWith(`${name}: `)).join("\n");
	const emitted = (name: string) => fake.emitted.filter((event) => event.name === name).map((event) => event.data);
	return { fake, home: dirname(fake.host.folder), gpu, release, free, round, later, line, lows: () => emitted("disk-low"), notices: () => emitted("notice").map((data) => (data as { text: string }).text) };
}

const sample = (disk?: readonly { path: string; free: number }[], skipped?: readonly string[]) => ({ at: NOW.toISOString(), jobs: [], cores: 8, load: 0, free: 8 * GB, total: 16 * GB, disk, skipped });

test("keepFree.disk takes bytes with K, M, G or T, or 0 for no floor; anything else is refused at load", async () => {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "arthur.config.ts"), "export default { core: {} };\n");
	const core = (await loadConfig(join(folder, "arthur.config.ts"))).core;
	const check = (disk: unknown) => resources({}).check?.({ keepFree: { disk } } as ResourcesOptions, core);
	for (const disk of ["20G", "512M", "1.5T", "1024K", "1", 0]) assert.deepEqual(check(disk), [], String(disk));
	for (const disk of ["10%", "infinity", "0", "20 GB", "-1G", "1P", 20, -1, null]) {
		assert.deepEqual(check(disk), [{ path: "keepFree.disk", problem: `expected bytes with K, M, G or T ("20G"), or 0 for no floor, got ${typeof disk === "string" ? JSON.stringify(disk) : String(disk)}` }], String(disk));
	}
});

test("the room under a disk floor: the least free filesystem holds the floor exactly, one KiB under it has no room, naming the machine, the path, the space and the floor; 0 is no floor", () => {
	const keep = { disk: "20G" };
	const home = { path: "/home/arthur/.arthur", free: 41 * GB };
	const at = sample([home, { path: "/var/lib/docker", free: 20 * GB }]);
	assert.deepEqual(roomOf("build", at, 0, {}, keep), { jobs: Infinity, line: "build: room for any number of jobs, perJob reserving nothing (8.0 GB, 8.0 cores, 20 GB disk free)" });
	const under = sample([home, { path: "/var/lib/docker", free: 20 * GB - 1024 }]);
	assert.deepEqual(roomOf("build", under, 0, {}, keep), { jobs: 0, line: "build: no room, 19.9 GB free on /var/lib/docker, floor 20 GB" });
	assert.equal(roomOf("build", sample([home, { path: "/var/lib/docker", free: 12.35 * GB }]), 0, {}, keep).line, "build: no room, 12.3 GB free on /var/lib/docker, floor 20 GB");
	assert.equal(roomOf("build", under, 0, {}, { disk: 0 }).jobs, Infinity, "floor 0: no floor");
	assert.equal(roomOf("build", sample([{ path: "/", free: 1024 }]), 0, {}, {}).jobs, Infinity, "no keepFree.disk: no floor");
	assert.equal(roomOf("local", sample([home]), 0, { cpu: 2, memory: "2G" }, keep).line, "local: room for 4 more jobs (8.0 GB, 8.0 cores, 41 GB disk free)");
	assert.equal(
		roomOf("local", sample([home]), 0, { memory: "8G" }, { memory: "1G", disk: "20G" }).line,
		"local: no room, short of 1.0 GB memory (8.0 GB, 8.0 cores, 41 GB disk free; keepFree 1.0 GB, 0.0 cores, 20 GB disk; a job reserves 8.0 GB, 0.0 cores)",
	);
	assert.deepEqual(roomOf("gpu", sample(), 0, {}, keep), { jobs: 0, line: "gpu: no room, its free disk not checked yet" }, "a check made without the floor");
	assert.equal(roomOf("gpu", sample([home], ["/var/lib/docker"]), 0, {}, keep).line, "gpu: room for any number of jobs, perJob reserving nothing (8.0 GB, 8.0 cores, 41 GB disk free)\ngpu: skipped /var/lib/docker, not there");
});

test("a spawn exactly at the floor starts; the floor hit mid-job leaves the job running, emits one disk-low and one notice, refuses the next spawn there while another machine has room", async (t) => {
	const { fake, home, gpu, release, free, round, later, line, lows, notices } = await load(t, { keepFree: { disk: "20G" } });
	disks([home, "/dev/sda1", FLOOR, "/"], [gpu, "/dev/sdb1", 2 * FLOOR, "/srv"]);
	const one = await fake.host.jobs.spawn({ task: "One." });
	assert.equal(one.failed, undefined);
	disks([home, "/dev/sda1", FLOOR - 1, "/"], [gpu, "/dev/sdb1", 2 * FLOOR, "/srv"]);
	later();
	assert.equal(await free("local"), 0);
	assert.equal(await round(), Infinity, "gpu keeps 40 GB free: placement takes it");
	const said = `local: no room, 19.9 GB free on ${home}, floor 20 GB`;
	assert.equal(line("local"), said);
	assert.deepEqual(lows(), [{ machine: "local", path: home, free: (FLOOR - 1) * 1024, floor: 20 * GB }]);
	assert.deepEqual(notices(), [`machine local: 19.9 GB free on ${home}, floor 20 GB; no job starts there until it is back at the floor, the running ones go on`]);
	assert.ok(fake.host.jobs.running().includes(one.id), "the running job goes on");
	await assert.rejects(fake.host.jobs.spawn({ task: "Two.", machine: "local" }), {
		message: `refused by resources: no room on local for another job: ${said}; gpu: room for any number of jobs, perJob reserving nothing (8.0 GB, 8.0 cores, 40 GB disk free); spawn again once a job ends`,
	});
	later();
	assert.equal(await free("local"), 0);
	assert.equal(lows().length, 1, "still under: no second disk-low");
	assert.equal(notices().length, 1);
	assert.ok(logged(sshLog).every((call) => call.includes(" gpu ")), "local's df runs here, not over ssh");
	release();
});

test("free space hovering around the floor emits one disk-low per fall under it, not one per check; gpu's df runs in the round's own ssh call", async (t) => {
	const { gpu, round, lows, notices, later } = await load(t, { keepFree: { disk: "20G" } });
	const rounds = [FLOOR - 1, FLOOR - 1, FLOOR, FLOOR - 1, FLOOR + 1, FLOOR - 1024];
	const answers: number[] = [];
	for (const free of rounds) {
		disks([gpu, "/dev/sdb1", free, "/"]);
		later();
		answers.push(await round());
	}
	assert.deepEqual(answers, [0, 0, Infinity, 0, Infinity, 0]);
	assert.deepEqual(lows(), [FLOOR - 1, FLOOR - 1, FLOOR - 1024].map((free) => ({ machine: "gpu", path: gpu, free: free * 1024, floor: 20 * GB })));
	assert.equal(notices().length, 3);
	assert.deepEqual(logged(sshLog), [], "no ssh call of its own: the round's check ran df on the paths its answer named");
	assert.deepEqual(logged(dfLog), rounds.map(() => `-Pk ${gpu}`));
	writeFileSync(join(dir, "fail"), "df: /: Input/output error\n");
	assert.equal(await round(), 0);
	disks([gpu, "/dev/sdb1", FLOOR - 1, "/"]);
	assert.equal(await round(), 0);
	assert.equal(lows().length, 4, "under again after a failed check is told again");
});

test("each path a plugin names counts: two on one filesystem once, the least free named, one missing there skipped with one line while the home still counts", async (t) => {
	const { fake, gpu, round, line } = await load(t, { keepFree: { disk: "20G" } });
	const [docker, gone] = [join(gpu, "docker"), join(gpu, "gone")];
	mkdirSync(docker);
	// Each answer a promise: a list, then a single path.
	const named: (string | string[])[] = [];
	fake.provide("resources.disk", (machine: string) => (machine === "gpu" ? Promise.resolve(named.at(-1)) : []));
	named.push([]);
	disks([gpu, "/dev/sda1", 3 * FLOOR, "/"]);
	assert.equal(await round(), Infinity);
	assert.equal(line("gpu"), "gpu: room for any number of jobs, perJob reserving nothing (8.0 GB, 8.0 cores, 60 GB disk free)", "without Docker, its home only");
	named.push([docker, gpu]);
	disks([gpu, "/dev/sda1", 3 * FLOOR, "/"], [docker, "/dev/sda1", 3 * FLOOR, "/"]);
	await round();
	const kept = JSON.parse(readFileSync(join(fake.host.folder, "machines", "gpu.json"), "utf8"));
	assert.deepEqual(kept.disk, [{ path: gpu, free: 3 * FLOOR * 1024 }], "three paths on one filesystem, counted once");
	disks([gpu, "/dev/sda1", 3 * FLOOR, "/"], [docker, "map docker data", FLOOR / 2, "/var/lib/docker"]);
	assert.equal(await round(), 0);
	assert.equal(line("gpu"), `gpu: no room, 10 GB free on ${docker}, floor 20 GB`);
	named.push([gone, docker]);
	disks([gpu, "/dev/sda1", 3 * FLOOR, "/"], [docker, "/dev/sdb1", 2 * FLOOR, "/var/lib/docker"]);
	assert.equal(await round(), Infinity);
	assert.equal(line("gpu"), `gpu: room for any number of jobs, perJob reserving nothing (8.0 GB, 8.0 cores, 40 GB disk free)\ngpu: skipped ${gone}, not there`);
	named.push(gone);
	await round();
	assert.equal(line("gpu"), `gpu: room for any number of jobs, perJob reserving nothing (8.0 GB, 8.0 cores, 60 GB disk free)\ngpu: skipped ${gone}, not there`, "the home still counts");
	named.push(["var/lib/docker"]);
	assert.equal(await round(), 0);
	assert.equal(line("gpu"), 'gpu: no room, its check failed: resources.disk answered "var/lib/docker", not an absolute path');
});

test("df output that cannot be read, a df or ssh that fails, or a home not there counts as no room, said once until a check answers", async (t) => {
	const { fake, gpu, free, round, later, line, notices } = await load(t, { keepFree: { disk: "20G" } });
	disks([gpu, "/dev/sda1", 3 * FLOOR, "/"]);
	writeFileSync(join(dir, "garbage"), "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sda1 lots\n");
	assert.equal(await round(), 0);
	const unread = 'gpu: no room, its check failed: df -Pk answered "Filesystem 1024-blocks Used Available Capacity Mounted on\\n/dev/sda1 lots", not POSIX df -P output';
	assert.equal(line("gpu"), unread);
	later();
	writeFileSync(join(dir, "garbage"), "");
	assert.equal(await round(), 0, "no line at all");
	assert.deepEqual(notices(), [`machine gpu: its room is unknown (${unread.slice("gpu: no room, its check failed: ".length)}); no job starts there until a check answers`]);
	disks([gpu, "/dev/sda1", 3 * FLOOR, "/"]);
	writeFileSync(join(dir, "fail"), "df: /srv: Input/output error\n");
	assert.equal(await round(), 0);
	assert.equal(line("gpu"), "gpu: no room, its check failed: df -Pk failed there: df: /srv: Input/output error");
	assert.equal(notices().length, 1, "a failure after a failure is not said again");
	disks([gpu, "/dev/sda1", 3 * FLOOR, "/"]);
	writeFileSync(join(dir, "gpu.down"), "");
	later();
	assert.equal(await free("gpu"), 0, "its own check: ssh refused");
	assert.equal(line("gpu"), "gpu: no room, its check failed: ssh failed: ssh: connect to host gpu port 22: Connection refused");
	rmSync(join(dir, "gpu.down"));
	assert.equal(await round(), Infinity);
	fake.host.jobs.registerMachine({ name: "cold", ssh: "cold", home: join(gpu, "nowhere"), labels: {} });
	assert.equal(await round("cold"), 0);
	assert.equal(line("cold"), `cold: no room, its check failed: its home ${join(gpu, "nowhere")} is not there`);
	assert.deepEqual(notices().slice(1), [`machine cold: its room is unknown (its home ${join(gpu, "nowhere")} is not there); no job starts there until a check answers`]);
});

test("two processes checking gpu at once say its fall under the floor and its failure once: the second reads the first's check under the machine file's lock, not the one before both", async (t) => {
	const { fake, gpu, round, later, lows, notices } = await load(t, { keepFree: { disk: "20G" } });
	const machines = join(fake.host.folder, "machines");
	disks([gpu, "/dev/sdb1", FLOOR, "/"]);
	assert.equal(await round(), Infinity);
	const under = sample([{ path: gpu, free: (FLOOR - 1) * 1024 }]);
	const gone = await otherCheck(join(machines, "gpu.json"), under);
	disks([gpu, "/dev/sdb1", FLOOR - 1, "/"]);
	later();
	assert.equal(await round(), 0);
	await gone();
	assert.deepEqual(lows(), [], "the other process's check said this fall");
	assert.equal(JSON.parse(readFileSync(join(machines, "gpu.json"), "utf8")).at, fake.host.clock.now().toISOString(), "this check is written after the other's");
	const failed = { at: NOW.toISOString(), jobs: [], error: "df -Pk failed there: df: /srv: Input/output error" };
	const goneAgain = await otherCheck(join(machines, "gpu.json"), failed);
	writeFileSync(join(dir, "fail"), "df: /srv: Input/output error\n");
	later();
	assert.equal(await round(), 0);
	await goneAgain();
	assert.deepEqual(notices(), [], "the other process's check said this failure");
	assert.deepEqual(readdirSync(machines), ["gpu.json"], "no lock left behind");
});

// Another process's check of the machine kept in `file`, as an `arthur spawn` makes it while `arthur run`'s is in flight: it
// holds the file's lock once this resolves, and writes `kept`, its check, and lets go once this process's check waits for the
// lock (its own lock file beside it) or has written the file without it. The function it resolves with waits until that
// process is gone.
async function otherCheck(file: string, kept: object): Promise<() => Promise<void>> {
	const code = `const { takeLock } = await import(${JSON.stringify(import.meta.resolve("@arthur/core/lock"))});
		const { existsSync, readFileSync, writeFileSync } = await import("node:fs");
		const { release } = takeLock(${JSON.stringify(`${file}.lock`)});
		const before = readFileSync(${JSON.stringify(file)}, "utf8");
		process.send("held");
		const wait = setInterval(() => {
			if (!existsSync(${JSON.stringify(`${file}.lock.${process.pid}`)}) && readFileSync(${JSON.stringify(file)}, "utf8") === before) return;
			clearInterval(wait);
			writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(`${JSON.stringify(kept)}\n`)});
			release();
			process.disconnect();
		}, 2);`;
	const child = spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
	const exited = once(child, "exit");
	await Promise.race([once(child, "message"), exited.then(([status]) => assert.fail(`the other check exited with ${status} before it held the lock`))]);
	return () => exited.then(([status]) => assert.equal(status, 0, "the other check exited cleanly"));
}

test("floor 0, or none, runs no df and keeps no disk: a machine with 1 KiB free still takes jobs", async (t) => {
	for (const keepFree of [{ disk: 0 as const }, {}]) {
		const { gpu, round, line } = await load(t, { keepFree });
		disks([gpu, "/dev/sda1", 1, "/"]);
		assert.equal(await round(), Infinity);
		assert.equal(line("gpu"), "gpu: room for any number of jobs, perJob reserving nothing (8.0 GB, 8.0 cores free)");
		assert.deepEqual([logged(dfLog), logged(sshLog)], [[], []]);
	}
});

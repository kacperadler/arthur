import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { coreVersion } from "../src/job-machine.ts";
import { jobRunner } from "../src/jobs.ts";
import { fakeAgent, jobSlice, temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const commit = (root: string, message: string) => git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", message);

// The fake `ssh` on PATH, for this file: it notes each call in `ssh.log` beside it and runs the command in the folder `machine`
// names in `machine` beside it, with `<machine>/bin` first on PATH, as ssh runs a command in a login's home; a file `refuse`
// there makes it fail as ssh does when the server refuses the key.
const bin = temporaryFolder();
const sshLog = join(bin, "ssh.log");
writeFileSync(
	join(bin, "ssh"),
	`#!/bin/sh
printf '%s\\n' "$*" >> '${sshLog}'
machine=$(cat '${join(bin, "machine")}')
while [ $# -gt 0 ]; do case "$1" in -o|-p|-l) shift 2;; -*) shift;; *) break;; esac; done
host=$1; shift
if [ -e "$machine/refuse" ]; then echo "kacper@$host: Permission denied (publickey)." >&2; exit 255; fi
cd "$machine" && PATH="$machine/bin:$PATH" exec sh -c "$*"
`,
	{ mode: 0o755 },
);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
const calls = () => (existsSync(sshLog) ? readFileSync(sshLog, "utf8").split("\n").filter(Boolean) : []);

// A repository `acme` with one commit, a home folder beside it, and a machine `gpu` in a folder of its own whose `arthur` is
// this core (`arthur` there: the script of `<machine>/bin/arthur`); the runner's plugin `machines` registers it.
function setup(options: { readonly agent?: string; readonly arthur?: string; readonly place?: () => unknown } = {}) {
	rmSync(sshLog, { force: true });
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	commit(root, "first");
	const home = join(folder, "home");
	const machine = temporaryFolder();
	writeFileSync(join(bin, "machine"), machine);
	mkdirSync(join(machine, "bin"));
	if (options.arthur !== "") writeFileSync(join(machine, "bin/arthur"), options.arthur ?? `#!/bin/sh\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	const there = join(machine, "arthur-home");
	const time = clock("UTC", undefined, () => new Date("2026-10-16T12:00:00Z"));
	const collect = (name: string) => (name === "jobs.place" && options.place !== undefined ? [options.place()] : []);
	const jobs = jobRunner(home, root, { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, ...jobSlice }, options.agent ?? "omp", time, eventBus(home), collect);
	jobs.registerMachine("machines", { name: "gpu", ssh: "gpu", home: there, labels: { os: "linux" } });
	return { root, home, machine, there, jobs };
}

async function until<T>(what: string, predicate: () => T | undefined | false): Promise<T> {
	for (const start = Date.now(); Date.now() - start < 20_000; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

const read = (home: string, id: string, name: string) => readFileSync(join(home, "jobs", id, name), "utf8");
const events = (home: string, name: string) => readEvents(home, 1).filter((event) => event.name === name).map((event) => event.data as Record<string, unknown>);

test("a worker on another machine runs there over SSH; the sweep copies its record and brings its branch back", async () => {
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Built it.", cost: 0.25 }] });
	const { root, home, there, jobs } = setup({ agent });
	const job = await jobs.spawn({ task: "Build it.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	const repository = join(there, "repos/acme.git");
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	assert.deepEqual([job.machine, job.worktree, job.root], ["gpu", worktree, root]);
	assert.equal(git(repository, "rev-parse", "--is-bare-repository"), "true", "the project's repository there was created");
	assert.equal(git(worktree, "branch", "--show-current"), job.branch);
	assert.equal(git(worktree, "rev-parse", "HEAD"), git(root, "rev-parse", "HEAD"));
	assert.equal(read(home, job.id, "machine"), "gpu");
	assert.equal(read(there, job.id, "root"), repository);
	for (const call of calls()) assert.match(call, /^-o BatchMode=yes -o StrictHostKeyChecking=yes .*gpu /, "every step runs through ssh's batch mode, host key checked");
	assert.equal(calls().filter((call) => call.includes("git-receive-pack")).length, 1);
	assert.equal(events(home, "job-started")[0]?.machine, "gpu");

	// The agent's commit there, made while it waits; the main checkout has the job's branch from an earlier run already.
	commit(worktree, "the change");
	const tip = git(worktree, "rev-parse", "HEAD");
	git(root, "branch", job.branch ?? "", git(root, "commit-tree", "main^{tree}", "-p", "main", "-m", "the earlier run"));
	assert.equal(existsSync(join(root, "..", ".arthur-worktrees", job.id)), false, "no worktree here");
	jobs.sweep();
	assert.equal(read(home, job.id, "state"), "working");
	assert.equal(read(home, job.id, "pid"), read(there, job.id, "pid"), "the sweep copied the run's files");
	writeFileSync(gate, "");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	assert.equal(events(home, "job-ended").length, 0);
	jobs.sweep();
	assert.deepEqual(["state", "reason", "result", "cost"].map((name) => read(home, job.id, name)), ["ended", "finished", "Built it.", "0.2500"]);
	assert.match(read(home, job.id, "commits"), /the change/);
	assert.equal(git(root, "rev-parse", job.branch ?? ""), tip, "the branch is fetched over the one from the earlier run");
	assert.deepEqual(git(root, "branch", "--list", "arthur/*", "--format=%(refname:short)").split("\n"), [job.branch]);
	assert.deepEqual(events(home, "job-ended"), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }]);
	assert.deepEqual(events(home, "job-state").map((data) => [data.machine, data.to]), [["gpu", "ended"]]);
	const copies = calls().length;
	jobs.sweep();
	assert.equal(calls().length, copies, "an ended job is not copied again");
	assert.equal(events(home, "job-ended").length, 1);

	const second = await jobs.spawn({ task: "Again.", machine: "gpu", kind: "worker" });
	assert.equal(second.failed, undefined);
	assert.equal(calls().filter((call) => call.includes("git-receive-pack")).length, 1, "the base commit there is not pushed twice");
});

test("an unknown machine, a refused key, arthur missing there or of another version refuse the spawn before any record", async () => {
	const nothing = (home: string, there: string) => [existsSync(join(home, "jobs")), existsSync(join(there, "jobs")), existsSync(join(there, "repos/.arthur-worktrees"))];
	const unknown = setup();
	await assert.rejects(unknown.jobs.spawn({ task: "Go.", machine: "mac" }), { message: "unknown machine mac; machines: gpu, local" });
	assert.deepEqual(calls(), []);

	const refused = setup();
	writeFileSync(join(refused.machine, "refuse"), "");
	await assert.rejects(refused.jobs.spawn({ task: "Go.", machine: "gpu" }), { message: "machine gpu: ssh gpu: kacper@gpu: Permission denied (publickey)." });
	assert.deepEqual(nothing(refused.home, refused.there), [false, false, false]);

	const missing = setup({ arthur: "" });
	await assert.rejects(missing.jobs.spawn({ task: "Go.", machine: "gpu" }), {
		message: new RegExp(`^machine gpu: arthur is not there \\(.*arthur.*not found\\); install the version here, ${coreVersion()} \\(docs/deploy\\.md\\)$`),
	});
	assert.deepEqual(nothing(missing.home, missing.there), [false, false, false]);

	const other = setup({ arthur: `#!/bin/sh\necho 0123456789ab\n` });
	await assert.rejects(other.jobs.spawn({ task: "Go.", machine: "gpu" }), { message: `machine gpu runs arthur 0123456789ab, this one is ${coreVersion()}; both need the same version` });
	assert.deepEqual(nothing(other.home, other.there), [false, false, false]);
	assert.equal(calls().length, 1, "nothing after the version");
});

test("a job on local takes no SSH step, at its spawn or at a sweep, while another machine is registered", async () => {
	const { home, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go." });
	assert.equal(read(home, job.id, "machine"), "local");
	await until("the job's end", () => read(home, job.id, "state") === "ended");
	jobs.sweep();
	assert.deepEqual(calls(), []);
});

test("without --machine the spawn goes where jobs.place answers; an unknown answer is refused", async () => {
	const placed = setup({ place: () => Promise.resolve("gpu") });
	const job = await placed.jobs.spawn({ task: "Go.", kind: "worker" });
	assert.equal(read(placed.home, job.id, "machine"), "gpu");
	const named = await placed.jobs.spawn({ task: "Go.", machine: "local" });
	assert.equal(read(placed.home, named.id, "machine"), "local", "a named machine wins over the placement");
	const wrong = setup({ place: () => undefined });
	await assert.rejects(wrong.jobs.spawn({ task: "Go." }), { message: "unknown machine undefined; machines: gpu, local" });
});

test("a prepare that throws on a job on another machine removes its worktree and record there and here", async () => {
	const { home, there, jobs } = setup();
	jobs.prepare("projects", () => {
		throw new Error("no install");
	});
	await assert.rejects(jobs.spawn({ task: "Go.", machine: "gpu" }), { message: "plugin projects: prepare failed: no install; the job's worktree and record were removed" });
	assert.deepEqual([readdirSync(join(home, "jobs")), readdirSync(join(there, "jobs")), readdirSync(join(there, "repos/.arthur-worktrees"))], [[], [], []]);
	assert.equal(git(join(there, "repos/acme.git"), "branch", "--list"), "");
});

test("a machine that does not answer fails the sweep, naming it, and its running job is not ended as process gone", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	writeFileSync(join(machine, "refuse"), "");
	for (const _ of [1, 2, 3]) assert.throws(() => jobs.sweep(), { message: "machine gpu: ssh gpu: kacper@gpu: Permission denied (publickey)." });
	assert.equal(read(home, job.id, "state"), "working");
	rmSync(join(machine, "refuse"));
	writeFileSync(gate, "");
	await until("the job's end there", () => {
		jobs.sweep();
		return read(home, job.id, "state") === "ended";
	});
});

test("registerMachine refuses local, a machine registered twice, a bad name, an ssh that is an option, and a relative home", () => {
	const { jobs } = setup();
	const machine = { name: "mac", ssh: "mac", home: "/Users/kacper/.arthur", labels: {} };
	assert.throws(() => jobs.registerMachine("machines", { ...machine, name: "local" }), { message: "machine local: registered by core and by machines; a machine belongs to one plugin" });
	assert.throws(() => jobs.registerMachine("other", { ...machine, name: "gpu" }), { message: "machine gpu: registered by machines and by other; a machine belongs to one plugin" });
	assert.throws(() => jobs.registerMachine("machines", { ...machine, name: "Mac" }), { message: 'machine "Mac": expected a name of lowercase letters, digits and dashes' });
	assert.throws(() => jobs.registerMachine("machines", { ...machine, ssh: "-oProxyCommand=sh" }), { message: 'machine mac: ssh must be a Host of ~/.ssh/config or a host name, got "-oProxyCommand=sh"' });
	assert.throws(() => jobs.registerMachine("machines", { ...machine, home: ".arthur" }), { message: 'machine mac: home must be an absolute path, got ".arthur"' });
	jobs.registerMachine("machines", machine);
});

test("arthur version prints the core's version, without a config", () => {
	const run = spawnSync(process.execPath, [CLI, "version"], { cwd: temporaryFolder(), encoding: "utf8" });
	assert.deepEqual([run.status, run.stdout], [0, `${coreVersion()}\n`]);
	assert.match(coreVersion(), /^[0-9a-f]{12}$/);
});

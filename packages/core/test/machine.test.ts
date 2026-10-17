import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { coreVersion, ssh, sshAsync } from "../src/job-machine.ts";
import type { Slice } from "../src/job-scope.ts";
import { jobRunner } from "../src/jobs.ts";
import { fakeAgent, fakeHost, jobSlice, temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const commit = (root: string, message: string) => git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", message);

// The fake `ssh` on PATH, for this file: it notes each call in `ssh.log` beside it and runs the command in the folder `machine`
// names in `machine` beside it, with `<machine>/bin` first on PATH, as ssh runs a command in a login's home; a file `refuse`
// there makes it fail as ssh does when the server refuses the key.
const bin = temporaryFolder();
// The machine's PATH has no `arthur` but the one in its own bin: not the one `npm test` puts on this PATH.
const machinePath = (process.env.PATH ?? "").split(delimiter).filter((folder) => !folder.includes("node_modules")).join(delimiter);
const sshLog = join(bin, "ssh.log");
writeFileSync(
	join(bin, "ssh"),
	`#!/bin/sh
printf '%s\\n' "$*" >> '${sshLog}'
machine=$(cat '${join(bin, "machine")}')
while [ $# -gt 0 ]; do case "$1" in -o|-p|-l) shift 2;; -*) shift;; *) break;; esac; done
host=$1; shift
if [ -e "$machine/refuse" ]; then echo "kacper@$host: Permission denied (publickey)." >&2; exit 255; fi
cd "$machine" && PATH="$machine/bin:${machinePath}" exec sh -c "$*"
`,
	{ mode: 0o755 },
);
process.env.PATH = [bin, process.env.PATH].join(delimiter);
// One line per call; a newline in a word goes on the next line, which does not start with an option.
const calls = () => (existsSync(sshLog) ? readFileSync(sshLog, "utf8").split("\n").filter((line) => line.startsWith("-o ")) : []);

// A repository `acme` with one commit, a home folder beside it, and a machine `gpu` in a folder of its own whose `arthur` is
// this core (`arthur` there: the script of `<machine>/bin/arthur`); the runner's plugin `machines` registers it, and `place`
// answers its `jobs.place`, one answer per plugin that provides it. The runner's clock stands at `now.at`, which a test moves.
function setup(options: { readonly agent?: string; readonly arthur?: string; readonly place?: () => readonly unknown[]; readonly slice?: Slice } = {}) {
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
	const now = { at: new Date("2026-10-16T12:00:00Z") };
	const time = clock("UTC", undefined, () => now.at);
	const collect = (name: string) => (name === "jobs.place" ? [...(options.place?.() ?? [])] : []);
	const limits = { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...(options.slice ?? jobSlice) };
	const jobs = jobRunner(home, root, limits, options.agent ?? "omp", time, eventBus(home), collect);
	jobs.registerMachine("machines", { name: "gpu", ssh: "gpu", home: there, labels: { os: "linux" } });
	return { root, home, machine, there, jobs, now };
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
	git(root, "branch", job.branch ?? "", git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit-tree", "main^{tree}", "-p", "main", "-m", "the earlier run"));
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
	const placed = setup({ place: () => [Promise.resolve("gpu")] });
	const job = await placed.jobs.spawn({ task: "Go.", kind: "worker" });
	assert.equal(read(placed.home, job.id, "machine"), "gpu");
	const named = await placed.jobs.spawn({ task: "Go.", machine: "local" });
	assert.equal(read(placed.home, named.id, "machine"), "local", "a named machine wins over the placement");
	const wrong = setup({ place: () => [undefined] });
	await assert.rejects(wrong.jobs.spawn({ task: "Go." }), { message: "unknown machine undefined; machines: gpu, local" });
	const two = setup({ place: () => ["gpu", "local"] });
	await assert.rejects(two.jobs.spawn({ task: "Go." }), { message: 'call("jobs.place"): provided by 2 plugins; call needs exactly one' });
	assert.equal(existsSync(join(two.home, "jobs")), false);
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

const messages = (agent: string) => (existsSync(join(agent, "..", "messages.jsonl")) ? readFileSync(join(agent, "..", "messages.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as unknown) : []);
const starts = (agent: string) => (existsSync(join(agent, "..", "starts.jsonl")) ? readFileSync(join(agent, "..", "starts.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as { readonly cwd: string }) : []);
const endedThere = (there: string, id: string) => until("the job's end there", () => existsSync(join(there, "jobs", id, "state")) && read(there, id, "state") === "ended");
const UNREACHABLE = "machine gpu: ssh gpu: kacper@gpu: Permission denied (publickey).";

test("arthur steer, stop, continue and prune of a job on another machine run there over SSH", async () => {
	const gates = temporaryFolder();
	const agent = fakeAgent({ steps: [{ waitFor: join(gates, "one") }, { tool: "read", args: { path: "README.md" } }, { waitFor: join(gates, "two") }, { message: "Done." }] });
	const { root, home, there, jobs } = setup({ agent });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	assert.equal(jobs.steer(job.id, "Use the second file."), "0001");
	writeFileSync(join(gates, "one"), "");
	await until("the steer there", () => messages(agent).length === 1);
	assert.deepEqual(messages(agent), [{ content: "Use the second file.", options: { deliverAs: "steer" }, step: 1 }]);

	assert.equal(await jobs.stop(job.id), `${job.id}: stopped`);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "stopped"], "the end there is here at once");
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["stopped"]);
	assert.equal(git(root, "rev-parse", job.branch ?? ""), git(worktree, "rev-parse", "HEAD"));

	// With both gates open, the continued run plays through to its end.
	writeFileSync(join(gates, "two"), "");
	assert.equal(await jobs.continue(job.id, "Go on.", 3), undefined);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "budget"), read(there, job.id, "budget")], ["working", "3", "3"]);
	assert.deepEqual(events(home, "job-started").map((data) => data.machine), ["gpu", "gpu"]);
	await endedThere(there, job.id);
	assert.deepEqual(starts(agent).map((start) => start.cwd), [worktree, worktree], "both runs there, in its worktree");
	assert.equal(read(there, job.id, "continue"), "Go on.");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	// A second continue, whose wrapper does not start there, ends here at once.
	rmSync(join(there, "jobs", job.id, "timeout"));
	const failed = await jobs.continue(job.id, "Once more.");
	assert.match(failed ?? "", /^the wrapper exited 1 before it wrote its pid; see /);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", `failed: ${failed}`]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["stopped", "finished", `failed: ${failed}`]);

	assert.deepEqual(jobs.prune([job.id]), [`${job.id}: worktree ${worktree} removed there; branch ${job.branch} deleted there; branch ${job.branch} deleted; record deleted`]);
	assert.deepEqual([existsSync(worktree), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id))], [false, false, false]);
	assert.deepEqual([git(join(there, "repos/acme.git"), "branch", "--list"), git(root, "branch", "--list", "arthur/*")], ["", ""]);
	for (const step of ["steer", "stop", "continue", "prune"]) assert.ok(calls().some((call) => call.includes(`'remote-job' '${step}'`)), step);
});

test("offline mid-job: stop, steer and continue are refused naming the machine; back before the grace, the job goes on as there", async () => {
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] });
	const { root, home, machine, there, jobs, now } = setup({ agent });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	writeFileSync(join(machine, "refuse"), "");
	jobs.sweep();
	const reason = "dependency: machine gpu unreachable since 2026-10-16T12:00:00.000Z";
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", reason]);
	await assert.rejects(jobs.stop(job.id), { message: UNREACHABLE });
	assert.throws(() => jobs.steer(job.id, "Also this."), { message: UNREACHABLE });
	await assert.rejects(jobs.continue(job.id, "Go on."), { message: UNREACHABLE });
	commit(worktree, "while offline");
	now.at = new Date("2026-10-16T12:29:59Z");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", reason], "a second short of the grace");

	rmSync(join(machine, "refuse"));
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), existsSync(join(home, "jobs", job.id, "offline"))], ["working", false], "it kept running there");
	assert.deepEqual(events(home, "job-state").map((data) => [data.to, data.reason]), [["blocked", reason], ["working", ""]]);
	commit(worktree, "once back");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	assert.deepEqual(git(root, "log", "--format=%s", job.branch ?? "").split("\n"), ["once back", "while offline", "first"]);
	assert.equal(starts(agent).length, 1, "the agent ran once");
	assert.deepEqual([events(home, "job-started").length, events(home, "job-ended").length], [1, 1]);
});

test("an ssh refused before it reads its input says ssh's own line, not EPIPE", async () => {
	const { machine, there } = setup();
	writeFileSync(join(machine, "refuse"), "");
	// More than a pipe holds: the write cannot finish before the refused ssh exits.
	const input = "x".repeat(1 << 20);
	const gpu = { name: "gpu", ssh: "gpu", home: there, labels: {} };
	assert.throws(() => ssh(gpu, ["cat"], input), { message: UNREACHABLE });
	await assert.rejects(sshAsync(gpu, ["cat"], input), { message: UNREACHABLE });
});

test("offline past the grace: failed once, the worktree there kept; its end and branch arrive when the machine is back", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, home, machine, there, jobs, now } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	writeFileSync(join(machine, "refuse"), "");
	jobs.sweep();
	now.at = new Date("2026-10-16T12:30:00Z");
	jobs.sweep();
	now.at = new Date("2026-10-16T12:31:00Z");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "failed: machine offline"]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["failed: machine offline"], "failed once");
	const line = "ended: failed: machine offline: machine gpu unreachable since 2026-10-16T12:00:00.000Z, past core.jobs.offlineGraceMinutes (30)";
	assert.equal(read(home, job.id, "log").split("\n").filter((text) => text.includes("machine offline")).length, 1);
	assert.ok(read(home, job.id, "log").includes(`[arthur 2026-10-16T12:30:00.000Z] ${line}\n`));
	assert.equal(read(there, job.id, "state"), "working", "the run there goes on");
	assert.equal(git(worktree, "branch", "--show-current"), job.branch);
	assert.match(jobs.prune([job.id])[0] ?? "", /: kept: it ended here while machine gpu did not answer; /);

	rmSync(join(machine, "refuse"));
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "failed: machine offline"], "back, while its run there goes on");
	commit(worktree, "the change");
	writeFileSync(join(machine, "refuse"), "");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	jobs.sweep();
	rmSync(join(machine, "refuse"));
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	assert.equal(git(root, "log", "-1", "--format=%s", job.branch ?? ""), "the change");
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["failed: machine offline", "finished"]);
	const copies = calls().length;
	jobs.sweep();
	assert.equal(calls().length, copies, "its end arrived; it is not followed any more");
});

test("prune never deletes a worktree on a machine it cannot reach, nor one Git refuses there; stopall stops a job there", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	const inRun = spawnSync(process.execPath, [CLI, "remote-job", "prune", there, job.id, ""], { cwd: there, encoding: "utf8" });
	assert.deepEqual([inRun.status, inRun.stderr, existsSync(worktree)], [1, `arthur remote-job: ${job.id} is working there, in a run\n`, true]);
	assert.equal(await jobs.stopAll(), `${job.id}: stopped`);
	assert.equal(read(home, job.id, "state"), "ended");
	writeFileSync(join(machine, "refuse"), "");
	assert.deepEqual(jobs.prune([job.id]), [`${job.id}: kept its worktree, branch and record: ${UNREACHABLE}`]);
	rmSync(join(machine, "refuse"));
	writeFileSync(join(worktree, "notes.txt"), "not committed\n");
	assert.deepEqual(jobs.prune([job.id]), [
		`${job.id}: kept its worktree, branch and record: machine gpu: arthur remote-job prune: git worktree: fatal: '${worktree}' contains modified or untracked files, use --force to delete it`,
	]);
	assert.deepEqual([existsSync(join(worktree, "notes.txt")), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id))], [true, true, true]);
	const other = jobRunner(home, there, { timeoutMinutes: 1, budgetUsd: 1, idleMinutes: 1, offlineGraceMinutes: 1, ...jobSlice }, "omp", clock("UTC", undefined), eventBus(home), () => []);
	await assert.rejects(other.stop(job.id), { message: `${job.id} runs on machine gpu, which no plugin registers; machines: local` });
});

test("a job there gets the machine's own joint limit, not this config's", { skip: spawnSync("systemctl", ["--user", "show-environment"]).status !== 0 && "no systemd user manager" }, async () => {
	const { jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }), slice: { ...jobSlice, cpu: 0.5, memory: "1G" } });
	await jobs.spawn({ task: "Go.", machine: "gpu" });
	const show = (property: string) => execFileSync("systemctl", ["--user", "show", `${jobSlice.slice}.slice`, "-p", property, "--value"], { encoding: "utf8" }).trim();
	assert.equal(show("CPUQuotaPerSecUSec"), `${Math.max(1, availableParallelism() - 1)}s`);
	assert.ok(Math.abs(Number(show("MemoryMax")) / totalmem() - 0.7) < 0.01, `MemoryMax ${show("MemoryMax")} of ${totalmem()}`);
});

test("a copy brings only the log's new bytes, appended here; arthur remote-job records sends the log from the byte asked", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	jobs.sweep();
	const before = read(there, job.id, "log");
	assert.equal(read(home, job.id, "log"), before);
	appendFileSync(join(there, "jobs", job.id, "log"), "one more line ✓\n");
	jobs.sweep();
	assert.equal(read(home, job.id, "log"), `${before}one more line ✓\n`);
	const records = (asked: string) => {
		const run = spawnSync(process.execPath, [CLI, "remote-job", "records", there, `${job.id}=${asked}`], { cwd: there, encoding: "utf8" });
		return (JSON.parse(run.stdout) as Record<string, { files: Record<string, string>; logFrom: number; logSize: number }>)[job.id];
	};
	const size = Buffer.byteLength(`${before}one more line ✓\n`);
	assert.deepEqual(records(`0:${Buffer.byteLength(before)}`), { ...records("0:0"), logFrom: Buffer.byteLength(before), files: { ...records("0:0")?.files, log: "one more line ✓\n" } });
	assert.deepEqual([records("0:0")?.logFrom, records("0:0")?.logSize, records(`0:${size + 1}`)?.logFrom], [0, size, 0], "a log shorter than asked comes whole");
	assert.deepEqual([records(`0:${size}`)?.logFrom, records(`0:${size}`)?.files.log], [size, ""], "caught up exactly: nothing new, not the whole log");
	writeFileSync(gate, "");
});

test("a wrapper that does not start there ends the job there, and here at once with job-ended", async () => {
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	// The record there loses a file between its add and the launch: the wrapper fails reading it, before its pid.
	jobs.prepare("projects", (job) => rmSync(join(there, "jobs", job.id, "timeout")));
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.match(job.failed ?? "", /^the wrapper exited 1 before it wrote its pid; see /);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", `failed: ${job.failed}`]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.id), [job.id]);
});

test("a plugin's hold on a job there stands at each copy while it runs there and through an offline spell, and ends with its run", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, there, jobs, now } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	jobs.block(job.id, "waiting for AR0001");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "hold")], ["blocked", "waiting for AR0001"]);
	writeFileSync(join(machine, "refuse"), "");
	jobs.sweep();
	assert.equal(read(home, job.id, "reason"), "dependency: machine gpu unreachable since 2026-10-16T12:00:00.000Z");
	rmSync(join(machine, "refuse"));
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", "dependency: waiting for AR0001"], "back: the hold's reason again");

	// Past the grace the hold goes with the run here, so the job is no longer in a run.
	const held = await jobs.spawn({ task: "Hold.", machine: "gpu" });
	jobs.block(held.id, "waiting for AR0002");
	writeFileSync(join(machine, "refuse"), "");
	jobs.sweep();
	now.at = new Date("2026-10-16T13:00:00Z");
	jobs.sweep();
	assert.deepEqual([read(home, held.id, "reason"), existsSync(join(home, "jobs", held.id, "hold"))], ["failed: machine offline", false]);
	rmSync(join(machine, "refuse"));
	writeFileSync(gate, "");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), existsSync(join(home, "jobs", job.id, "hold"))], ["ended", false]);
	const copies = calls().length;
	jobs.sweep();
	assert.equal(calls().length, copies, "a job no longer held nor in a run is not copied again");
});

test("arthur spawn --machine names the machine; arthur remote-job refuses an unknown step, a relative home and a bad project", () => {
	const root = setup().root;
	writeFileSync(join(root, "arthur.config.ts"), 'export default { core: { timeZone: "UTC" }, plugins: [{ name: "orchestration", setup() {} }] };\n');
	const arthur = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8" });
	const spawned = arthur("spawn", "Go.", "--machine", "mac");
	assert.deepEqual([spawned.status, spawned.stderr], [1, "arthur spawn: unknown machine mac; machines: local\n"]);
	const usage = "usage: arthur remote-job repo|add|launch|stop|steer|continue|prune|remove|records <home> [args]\n";
	assert.deepEqual([arthur("remote-job", "push", "/x").status, arthur("remote-job", "push", "/x").stderr], [2, `arthur remote-job: unknown step "push"\n${usage}`]);
	assert.deepEqual([arthur("remote-job", "repo", "home").status, arthur("remote-job", "repo", "home").stderr], [2, `arthur remote-job: the home folder must be an absolute path\n${usage}`]);
	const home = temporaryFolder();
	const bad = arthur("remote-job", "repo", home, "../acme", "HEAD");
	assert.deepEqual([bad.status, bad.stderr], [1, 'arthur remote-job: a project name, got "../acme"\n']);
	assert.deepEqual(readdirSync(home), []);
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
	const host = fakeHost({ name: "machines" }).host;
	assert.throws(() => host.jobs.registerMachine({ ...machine, name: "local" }), { message: "machine local: registered by core and by machines; a machine belongs to one plugin" });
});

test("jobs.run runs one command on a machine: words with spaces, quotes, backticks and newlines arrive intact, the exit code comes back", async () => {
	const { machine, jobs } = setup();
	const words = ["a b", `it's "quoted"`, "$HOME", "", "; touch hacked", "`touch ticked`", "line\nnext; touch newline"];
	assert.deepEqual(await jobs.run("gpu", ["printf", "%s|", ...words]), { code: 0, stdout: `${words.join("|")}|`, stderr: "" });
	assert.deepEqual(["hacked", "ticked", "newline"].map((name) => existsSync(join(machine, name))), [false, false, false]);
	assert.deepEqual(await jobs.run("gpu", ["sh", "-c", "pwd; echo no >&2; exit 3"]), { code: 3, stdout: `${machine}\n`, stderr: "no\n" });
	assert.equal(calls().length, 2);
	assert.match(calls()[0] ?? "", /^-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 gpu 'printf' /);
	writeFileSync(join(machine, "refuse"), "");
	assert.deepEqual(await jobs.run("gpu", ["true"]), { code: 255, stdout: "", stderr: "kacper@gpu: Permission denied (publickey).\n" });
	await assert.rejects(jobs.run("mac", ["true"]), { message: "unknown machine mac; machines: gpu, local" });
	await assert.rejects(jobs.run("gpu", []), { message: "run: argv must be a non-empty list of words" });

	const host = fakeHost({ name: "projects" }).host;
	assert.deepEqual(await host.jobs.run("local", ["sh", "-c", 'printf "%s" "$1"; exit 4', "sh", "a b"]), { code: 4, stdout: "a b", stderr: "" });
	assert.deepEqual(await host.jobs.run("local", ["no-such-command-here"]), { code: 127, stdout: "", stderr: "no-such-command-here: spawn no-such-command-here ENOENT" });
	assert.equal(calls().length, 3, "local takes no SSH step");
});

test("arthur version prints the core's version, without a config", () => {
	const run = spawnSync(process.execPath, [CLI, "version"], { cwd: temporaryFolder(), encoding: "utf8" });
	assert.deepEqual([run.status, run.stdout], [0, `${coreVersion()}\n`]);
	assert.match(coreVersion(), /^[0-9a-f]{12}$/);
});

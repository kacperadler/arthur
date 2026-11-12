import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { clock } from "../src/clock.ts";
import { eventBus } from "../src/events.ts";
import { jobRunner } from "../src/jobs.ts";
import { fakeAgent, jobSlice, temporaryFolder, until } from "../src/testing.ts";
import { CLI, calls, commit, endedThere, events, git, MAY_RUN, messages, read, setup, starts, UNREACHABLE } from "./fake-machine.ts";

// Jobs on another machine (fake-machine.ts): stop, steer, continue and prune of a job there, and the machine offline.

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
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	// A second continue, whose wrapper does not start there, ends here at once.
	rmSync(join(there, "jobs", job.id, "timeout"));
	const failed = await jobs.continue(job.id, "Once more.");
	assert.match(failed ?? "", /^the wrapper exited 1 before it wrote its pid; see /);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", `failed: ${failed}`]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["stopped", "finished", `failed: ${failed}`]);

	assert.deepEqual(await jobs.prune([job.id]), [`${job.id}: worktree ${worktree} removed there; branch ${job.branch} deleted there; branch ${job.branch} deleted; record deleted`]);
	assert.deepEqual([existsSync(worktree), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id))], [false, false, false]);
	assert.deepEqual([git(join(there, "repos/acme.git"), "branch", "--list"), git(root, "branch", "--list", "arthur/*")], ["", ""]);
	for (const step of ["steer", "stop", "continue", "prune"]) assert.ok(calls().some((call) => call.includes(`'remote-job' '${step}'`)), step);
});

test("a prune there is refused, removing nothing, while the job's worktree there reads a key that may name a program, from the shared config or its own", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const [repository, worktree] = [join(there, "repos/acme.git"), join(there, "repos/.arthur-worktrees", job.id)];
	// A file a clean filter reads, as a job's commit leaves it; `git status` in the worktree runs the filter while its stat is stale.
	writeFileSync(join(worktree, ".gitattributes"), "a filter=x\n");
	writeFileSync(join(worktree, "a"), "a\n");
	git(worktree, "add", ".gitattributes", "a");
	commit(worktree, "a file");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	await jobs.sweep();
	const [ran, filter] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "clean")];
	writeFileSync(filter, `#!/bin/sh\necho clean >> '${ran}'\ncat\n`, { mode: 0o755 });
	const [old, kept] = [new Date("2000-01-01"), `${job.id}: kept its worktree, branch and record: machine gpu: arthur remote-job prune: git worktree:`];
	const all = () => [existsSync(worktree), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id)), existsSync(ran)];
	git(repository, "config", "filter.x.clean", filter);
	utimesSync(join(worktree, "a"), old, old);
	assert.deepEqual(await jobs.prune([job.id]), [`${kept} ${join(repository, "config")} sets filter.x.clean, ${MAY_RUN}`]);
	assert.deepEqual(all(), [true, true, true, false], "the shared config's: everything kept, nothing run");
	// The worktree's own config.worktree, which Git reads once `extensions.worktreeConfig` is on (core.bare moved, as commit-rules does).
	git(repository, "config", "--unset", "filter.x.clean");
	git(repository, "config", "--unset", "core.bare");
	git(repository, "config", "extensions.worktreeConfig", "true");
	git(repository, "config", "--worktree", "core.bare", "true");
	git(worktree, "config", "--worktree", "filter.x.clean", filter);
	assert.deepEqual(await jobs.prune([job.id]), [`${kept} ${join(repository, "worktrees", job.id, "config.worktree")} sets filter.x.clean, ${MAY_RUN}`]);
	assert.deepEqual(all(), [true, true, true, false], "the worktree's own: everything kept, nothing run");
	git(worktree, "status", "--porcelain");
	assert.match(readFileSync(ran, "utf8"), /^clean$/m, "git status in the worktree, which git worktree remove runs, runs it");
	// A worktree gone there leaves no `git status` to run: `git worktree prune` takes its place, the key still set.
	rmSync(ran);
	rmSync(worktree, { recursive: true, force: true });
	assert.match((await jobs.prune([job.id]))[0] ?? "", new RegExp(`^${job.id}: branch ${job.branch} deleted there; `));
	assert.deepEqual(all(), [false, false, true, false], "pruned there, nothing run");
});

test("a prune there reads past a replacement under refs/replace in the repository there: the job's clean worktree is removed", async () => {
	const { there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await endedThere(there, job.id);
	await jobs.sweep();
	// The worktree's commit (of no file) read as one with a file, as a job's git replace there would write: its deletion would
	// look staged, so a plain `git worktree remove` refuses the clean worktree.
	const repository = join(there, "repos/acme.git");
	const blob = execFileSync("git", ["-C", repository, "hash-object", "-w", "--stdin"], { input: "x\n", encoding: "utf8" }).trim();
	const tree = execFileSync("git", ["-C", repository, "mktree"], { input: `100644 blob ${blob}\tx\n`, encoding: "utf8" }).trim();
	git(repository, "replace", git(repository, "rev-parse", "refs/arthur/base"), git(repository, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit-tree", "-m", "fake", tree));
	const removed = `${job.id}: worktree ${join(there, "repos/.arthur-worktrees", job.id)} removed there; branch ${job.branch} deleted there; branch ${job.branch} deleted; record deleted`;
	assert.deepEqual(await jobs.prune([job.id]), [removed]);
});

test("a prune there keeps everything of a job whose record there names a branch or worktree its spawn did not make, and one here whose record names another checkout, saying why", async () => {
	const { root, home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await endedThere(there, job.id);
	await jobs.sweep();
	const [repository, worktree, victim] = [join(there, "repos/acme.git"), join(there, "repos/.arthur-worktrees", job.id), join(there, "victim")];
	// The owner's branch there at the job's tip, which `git update-ref -d` would delete, and its worktree, which `git worktree remove` would remove.
	git(repository, "worktree", "add", "--quiet", victim, git(repository, "branch", "owner", `arthur/${job.id}`) || "owner");
	const write = (record: string, name: string, value: string) => writeFileSync(join(record, "jobs", job.id, name), value);
	const all = () => [existsSync(worktree), existsSync(victim), git(repository, "branch", "--list", "--format=%(refname:short)", "owner", `arthur/${job.id}`), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id))];
	const kept = `${job.id}: kept its worktree, branch and record: `;
	write(there, "branch", "owner");
	assert.deepEqual(await jobs.prune([job.id]), [`${kept}machine gpu: arthur remote-job prune: its record names the branch owner, where the spawn made arthur/${job.id} or none`]);
	assert.deepEqual(all(), [true, true, `arthur/${job.id}\nowner`, true, true]);
	write(there, "branch", `arthur/${job.id}`);
	write(there, "worktree", victim);
	assert.deepEqual(await jobs.prune([job.id]), [`${kept}machine gpu: arthur remote-job prune: its record names the checkout ${repository} and the worktree ${victim}, where a job of acme has ${repository} and ${worktree}`]);
	assert.deepEqual(all(), [true, true, `arthur/${job.id}\nowner`, true, true]);
	write(there, "worktree", worktree);
	// Here, the record's checkout is checked; its worktree is the one there.
	const elsewhere = temporaryFolder();
	write(home, "root", elsewhere);
	assert.deepEqual(await jobs.prune([job.id]), [`${kept}its record names the checkout ${elsewhere}, where a job of acme has ${root}`]);
	assert.deepEqual(all(), [true, true, `arthur/${job.id}\nowner`, true, true]);
	write(home, "root", root);
	assert.deepEqual(await jobs.prune([job.id]), [`${job.id}: worktree ${worktree} removed there; branch ${job.branch} deleted there; branch ${job.branch} deleted; record deleted`]);
	assert.deepEqual(all(), [false, true, "owner", false, false]);
});

test("offline mid-job: stop, steer and continue are refused naming the machine; back before the grace, the job goes on as there", async () => {
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] });
	const { root, home, machine, there, jobs, now } = setup({ agent });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	writeFileSync(join(machine, "refuse"), "");
	await jobs.sweep();
	const reason = "dependency: machine gpu unreachable since 2026-10-16T12:00:00.000Z";
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", reason]);
	await assert.rejects(jobs.stop(job.id), { message: UNREACHABLE });
	assert.throws(() => jobs.steer(job.id, "Also this."), { message: UNREACHABLE });
	await assert.rejects(jobs.continue(job.id, "Go on."), { message: UNREACHABLE });
	commit(worktree, "while offline");
	now.at = new Date("2026-10-16T12:29:59Z");
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", reason], "a second short of the grace");

	rmSync(join(machine, "refuse"));
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), existsSync(join(home, "jobs", job.id, "offline"))], ["working", false], "it kept running there");
	assert.deepEqual(events(home, "job-state").map((data) => [data.to, data.reason]), [["blocked", reason], ["working", ""]]);
	commit(worktree, "once back");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	assert.deepEqual(git(root, "log", "--format=%s", job.branch ?? "").split("\n"), ["once back", "while offline", "first"]);
	assert.equal(starts(agent).length, 1, "the agent ran once");
	assert.deepEqual([events(home, "job-started").length, events(home, "job-ended").length], [1, 1]);
});

test("offline past the grace: failed once, the worktree there kept; its end and branch arrive when the machine is back", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, home, machine, there, jobs, now } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	writeFileSync(join(machine, "refuse"), "");
	await jobs.sweep();
	now.at = new Date("2026-10-16T12:30:00Z");
	await jobs.sweep();
	now.at = new Date("2026-10-16T12:31:00Z");
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "failed: machine offline"]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["failed: machine offline"], "failed once");
	const line = "ended: failed: machine offline: machine gpu unreachable since 2026-10-16T12:00:00.000Z, past core.jobs.offlineGraceMinutes (30)";
	assert.equal(read(home, job.id, "log").split("\n").filter((text) => text.includes("machine offline")).length, 1);
	assert.ok(read(home, job.id, "log").includes(`[arthur 2026-10-16T12:30:00.000Z] ${line}\n`));
	assert.equal(read(there, job.id, "state"), "working", "the run there goes on");
	assert.equal(git(worktree, "branch", "--show-current"), job.branch);
	assert.match((await jobs.prune([job.id]))[0] ?? "", /: kept: it ended here while machine gpu did not answer; /);

	rmSync(join(machine, "refuse"));
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "failed: machine offline"], "back, while its run there goes on");
	commit(worktree, "the change");
	writeFileSync(join(machine, "refuse"), "");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	await jobs.sweep();
	rmSync(join(machine, "refuse"));
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "finished"]);
	assert.equal(git(root, "log", "-1", "--format=%s", job.branch ?? ""), "the change");
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["failed: machine offline", "finished"]);
	const copies = calls().length;
	await jobs.sweep();
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
	// The hooks run before the SSH that does not answer; their text stays in the line of what was kept.
	jobs.cleanup("docker", () => "nothing to clean");
	assert.deepEqual(await jobs.prune([job.id]), [`${job.id}: docker: nothing to clean; kept its worktree, branch and record: ${UNREACHABLE}`]);
	rmSync(join(machine, "refuse"));
	writeFileSync(join(worktree, "notes.txt"), "not committed\n");
	assert.deepEqual(await jobs.prune([job.id]), [
		`${job.id}: docker: nothing to clean; kept its worktree, branch and record: machine gpu: arthur remote-job prune: git worktree: fatal: '${worktree}' contains modified or untracked files, use --force to delete it`,
	]);
	assert.deepEqual([existsSync(join(worktree, "notes.txt")), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id))], [true, true, true]);
	const other = jobRunner(home, there, join(there, "env"), { timeoutMinutes: 1, budgetUsd: 1, idleMinutes: 1, offlineGraceMinutes: 1, unsandboxed: true, ...jobSlice }, "omp", clock("UTC", undefined), eventBus(home), () => []);
	await assert.rejects(other.stop(job.id), { message: `${job.id} runs on machine gpu, which no plugin registers; machines: local` });
});

test("a plugin's hold on a job there stands at each copy while it runs there and through an offline spell, and ends with its run", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, there, jobs, now } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	jobs.block(job.id, "waiting for AR0001");
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "hold")], ["blocked", "waiting for AR0001"]);
	writeFileSync(join(machine, "refuse"), "");
	await jobs.sweep();
	assert.equal(read(home, job.id, "reason"), "dependency: machine gpu unreachable since 2026-10-16T12:00:00.000Z");
	rmSync(join(machine, "refuse"));
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", "dependency: waiting for AR0001"], "back: the hold's reason again");

	// Past the grace the hold goes with the run here, so the job is no longer in a run.
	const held = await jobs.spawn({ task: "Hold.", machine: "gpu" });
	jobs.block(held.id, "waiting for AR0002");
	writeFileSync(join(machine, "refuse"), "");
	await jobs.sweep();
	now.at = new Date("2026-10-16T13:00:00Z");
	await jobs.sweep();
	assert.deepEqual([read(home, held.id, "reason"), existsSync(join(home, "jobs", held.id, "hold"))], ["failed: machine offline", false]);
	rmSync(join(machine, "refuse"));
	writeFileSync(gate, "");
	// The held job's run there went on through the offline spell, and a copy follows it until that run ends: wait for both.
	for (const id of [job.id, held.id]) await until("the job's end there", () => existsSync(join(there, "jobs", id, "state")) && read(there, id, "state") === "ended");
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), existsSync(join(home, "jobs", job.id, "hold"))], ["ended", false]);
	const copies = calls().length;
	await jobs.sweep();
	assert.equal(calls().length, copies, "a job no longer held nor in a run is not copied again");
});

test("a block with stop on a job there stops its run there and holds it blocked on the user here; the feature slice goes there, a continue's caps too", async () => {
	const gate = join(temporaryFolder(), "go");
	let answer: unknown = { feature: { name: "AC0001", cpu: 1, memory: "1G" } };
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }), caps: () => [answer] });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.deepEqual(["feature", "feature-cpu", "feature-memory"].map((name) => read(there, job.id, name)), ["AC0001", "1", "1G"]);
	await jobs.block(job.id, "feature cap hours reached: 8.00 h of 8 h", true);
	await jobs.sweep();
	const reason = "user: feature cap hours reached: 8.00 h of 8 h";
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason"), existsSync(join(home, "jobs", job.id, "hold"))], ["blocked", reason, false]);
	assert.deepEqual([read(there, job.id, "state"), read(there, job.id, "reason")], ["ended", "stopped"]);
	assert.deepEqual(events(home, "job-ended"), [{ id: job.id, kind: "worker", project: "acme", state: "blocked", reason }]);
	// The human raised the ticket's caps: the continue there runs with those in force now.
	answer = { memory: "2G", feature: { name: "AC0001", memory: "4G" } };
	writeFileSync(gate, "");
	assert.equal(await jobs.continue(job.id, "The cap was raised; go on."), undefined);
	const names = ["cpu", "memory", "feature", "feature-cpu", "feature-memory"];
	assert.deepEqual(names.map((name) => read(there, job.id, name)), ["", "2G", "AC0001", "", "4G"]);
	assert.deepEqual(names.map((name) => read(home, job.id, name)), ["", "2G", "AC0001", "", "4G"]);
	await endedThere(there, job.id);
});

test("arthur stop ends a job there blocked on the user here, without SSH; arthur prune then frees it there and here, after jobs.cleanup saw it on its machine", async () => {
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Blocked: user is AR0455 met by AR0454?" }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "blocked");
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", "user: is AR0455 met by AR0454?"]);
	assert.equal(await jobs.stop(job.id), `${job.id}: stopped`);
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["ended", "stopped"]);
	assert.deepEqual(events(home, "job-ended").map((data) => data.reason), ["user: is AR0455 met by AR0454?", "stopped"]);
	assert.equal(calls().some((call) => call.includes("'remote-job' 'stop'")), false, "its state here is the one that counts");
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	const seen: string[] = [];
	jobs.cleanup("docker", (each) => (seen.push(`${each.id} on ${each.machine}, its worktree there ${existsSync(worktree)}`), "1 network removed"));
	assert.deepEqual(await jobs.prune([job.id]), [`${job.id}: docker: 1 network removed; worktree ${worktree} removed there; branch ${job.branch} deleted there; branch ${job.branch} deleted; record deleted`]);
	assert.deepEqual([existsSync(worktree), existsSync(join(there, "jobs", job.id)), existsSync(join(home, "jobs", job.id))], [false, false, false]);
	assert.deepEqual(seen, [`${job.id} on gpu, its worktree there true`]);
});

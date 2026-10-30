import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { mock, test } from "node:test";
import { clock } from "../src/clock.ts";
import { type CommandRegistry, commandRegistry } from "../src/commands.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { jobCommands } from "../src/job-commands.ts";
import { findJob } from "../src/job-records.ts";
import { type JobRunner, jobRunner } from "../src/jobs.ts";
import { fakeAgent, jobSlice, temporaryFolder, until } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const NOW = new Date("2026-10-16T12:00:00Z");

// A repository `acme`, a home folder beside it, a runner on `agent` whose `jobs.keep` is `keep`, and the core's job commands
// on a registry, as a channel routes them; the plugin `delivery` owns the read-only kind `review`.
function setup(agent = fakeAgent({ steps: [{ message: "Done." }] }), keep: (job: unknown) => unknown = () => undefined) {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const home = join(folder, "home");
	mkdirSync(home);
	const time = clock("UTC", undefined, () => NOW);
	const bus = eventBus(home);
	const jobs = jobRunner(home, root, join(root, "env"), { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, ...jobSlice }, agent, time, bus, (name, [job]) => (name === "jobs.keep" ? [keep(job)] : []));
	writeFileSync(join(folder, "reviewer.md"), "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(join(folder, "reviewer.md")), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	const commands = commandRegistry();
	for (const command of jobCommands(() => home, () => jobs, () => (name, data) => void bus.emit("core", name, data))) commands.register("core", command);
	return { root, home, jobs, commands };
}

const field = (home: string, id: string, name: string) => readFileSync(join(home, "jobs", id, name), "utf8");
const events = (home: string, name: string) => readEvents(home, 1).filter((event) => event.name === name).map((event) => event.data);
const finished = (home: string, id: string) => until(`${id} ended`, () => existsSync(join(home, "jobs", id, "state")) && field(home, id, "state") === "ended");

// A record as the spawn and the wrapper leave it, spawned at `born`, its state taken at `at`.
function record(home: string, id: string, keys: Readonly<Record<string, string>>, born: Date, at = born): void {
	const folder = join(home, "jobs", id);
	mkdirSync(folder, { recursive: true });
	for (const [key, value] of Object.entries({ kind: "worker", project: "acme", task: "Go.", budget: "2", since: at.toISOString(), ...keys })) writeFileSync(join(folder, key), value);
	utimesSync(join(folder, "kind"), born, born);
}

test("arthur jobs: every project's jobs grouped by state, newest first, one line each with the short id and the reason; no jobs says so", () => {
	const { home, jobs } = setup();
	assert.equal(jobs.list(), "no jobs");
	const hours = (count: number) => new Date(NOW.getTime() - count * 3_600_000);
	record(home, "2026-10-16-worker-0000000a", { task: "Ticket: spec/features/AR0018-jobs/ticket.md.", state: "working", cost: "0.4" }, hours(2), hours(1.25));
	record(home, "2026-10-15-worker-0000000b", { state: "ended", reason: "finished", cost: "1.234" }, hours(30), hours(29));
	record(home, "2026-10-16-review-0000000c", { kind: "review", task: "Review.\nTicket: `spec/features/AR0017-stop/ticket.md`", state: "ended", reason: "finished", cost: "0.5" }, hours(3), hours(2.5));
	record(home, "2026-10-16-worker-0000000d", { state: "ended", reason: "failed: the agent exited 1", project: "shop" }, hours(4), hours(3.5));
	record(home, "2026-10-16-worker-0000000e", { state: "blocked", reason: "user: may I drop the old table?", cost: "2" }, hours(5), hours(4.5));
	record(home, "2026-10-16-worker-0000000f", { state: "idle", since: "" }, hours(0.1));
	record(home, "2026-10-16-worker-00000011", { state: "blocked", reason: "dependency: machine mac unreachable", hold: "machine mac unreachable" }, hours(0.2), hours(0.05));
	mkdirSync(join(home, "jobs", ".2026-10-16-worker-00000010"), { recursive: true });
	writeFileSync(join(home, "jobs", ".2026-10-16-worker-00000010", "kind"), "worker");
	assert.equal(
		jobs.list(),
		[
			"blocked",
			"-  worker  blocked  0h03m  $0.00/$2.00  acme  00000011  dependency: machine mac unreachable",
			"-  worker  blocked  4h30m  $2.00/$2.00  acme  0000000e  user: may I drop the old table?",
			"",
			"working",
			"AR0018  worker  working  1h15m  $0.40/$2.00  acme  0000000a",
			"",
			"idle",
			"-  worker  idle  -  $0.00/$2.00  acme  0000000f",
			"",
			"ended",
			"AR0017  review  ended  09:30  $0.50/$2.00  acme  0000000c  finished",
			"-  worker  ended  08:30  $0.00/$2.00  shop  0000000d  failed: the agent exited 1",
			"-  worker  ended  2026-10-15  $1.23/$2.00  acme  0000000b  finished",
		].join("\n"),
	);
	assert.equal(jobs.list("blocked").split("\n").slice(1).map((line) => line.split("  ")[5]).join(" "), "00000011 0000000e");
	assert.equal(jobs.list("ended").split("\n")[0], "ended");
	assert.equal(jobs.list("working"), "working\nAR0018  worker  working  1h15m  $0.40/$2.00  0000000a");
	rmSync(join(home, "jobs", "2026-10-16-worker-0000000f"), { recursive: true });
	assert.equal(jobs.list("idle"), "no idle jobs");
});

test("host.jobs.list(): every record in any state, newest spawn first, missing files empty; running() is the ids of those in a run", () => {
	const { home, jobs } = setup();
	assert.deepEqual([jobs.records(), jobs.running()], [[], []]);
	const hours = (count: number) => new Date(NOW.getTime() - count * 3_600_000);
	const ticket = "spec/features/AR0018-jobs/ticket.md";
	record(home, "2026-10-16-worker-0000000a", { task: `Ticket: ${ticket}.\nTicket: \`${ticket}\``, state: "working", branch: "arthur/a", cost: "1.2500", budget: "2", ran: "60" }, hours(1));
	record(home, "2026-10-16-review-0000000b", { kind: "review", project: "shop", state: "ended", reason: "finished", machine: "mac" }, hours(2));
	record(home, "2026-10-16-worker-0000000c", { state: "idle" }, hours(3));
	record(home, "2026-10-16-worker-0000000d", { state: "blocked", reason: "user: may I?" }, hours(4));
	record(home, "2026-10-16-worker-0000000e", { state: "blocked", reason: "dependency: x", hold: "x" }, hours(5));
	record(home, "2026-10-16-worker-0000000f", { task: "" }, hours(6));
	mkdirSync(join(home, "jobs", ".2026-10-16-worker-00000010"), { recursive: true });
	writeFileSync(join(home, "jobs", ".2026-10-16-worker-00000010", "kind"), "worker");
	const [first, second] = jobs.records();
	const fields = { id: "2026-10-16-worker-0000000a", kind: "worker", project: "acme", state: "working", reason: "", hold: "", since: hours(1).toISOString(), branch: "arthur/a", machine: "local" };
	assert.deepEqual(first, { ...fields, cost: "1.2500", budget: "2", seconds: 3660, tickets: [ticket] }, "a job in a run: its ran and the hour since");
	assert.deepEqual(second, { id: "2026-10-16-review-0000000b", kind: "review", project: "shop", state: "ended", reason: "finished", hold: "", since: hours(2).toISOString(), branch: "", machine: "mac", cost: "", budget: "2", seconds: 0, tickets: [] });
	assert.deepEqual(jobs.records().map((job) => [job.id.slice(-1), job.state, job.hold]), [["a", "working", ""], ["b", "ended", ""], ["c", "idle", ""], ["d", "blocked", ""], ["e", "blocked", "x"], ["f", "", ""]]);
	assert.deepEqual(jobs.running(), ["2026-10-16-worker-0000000a", "2026-10-16-worker-0000000c", "2026-10-16-worker-0000000e"]);
});

test("host.jobs.result(id): the record's final message, empty without one; anything but a job id is refused before a read", () => {
	const { home, jobs } = setup();
	record(home, "2026-10-16-worker-0000000a", { state: "ended", result: "Built it.\nTwo lines." }, NOW);
	record(home, "2026-10-16-worker-0000000b", { state: "working" }, NOW);
	assert.deepEqual(["0000000a", "0000000b", "0000000c"].map((hex) => jobs.result(`2026-10-16-worker-${hex}`)), ["Built it.\nTwo lines.", "", ""]);
	for (const id of ["0000000a", "../2026-10-16-worker-0000000a", "2026-10-16-worker-0000000a/../../x", ""])
		assert.throws(() => jobs.result(id), { message: `${JSON.stringify(id)}: not a job id (<date>-<kind>-<8 hex digits>)` });
});

test("a job is named by its full or short id; a short id that matches two jobs is refused with both, an unknown one too", () => {
	const { home } = setup();
	record(home, "2026-10-16-worker-0000000a", {}, NOW);
	record(home, "2026-10-15-review-0000000a", {}, NOW);
	record(home, "2026-10-16-worker-0000000b", {}, NOW);
	assert.equal(findJob(home, "0000000b"), "2026-10-16-worker-0000000b");
	assert.equal(findJob(home, "2026-10-16-worker-0000000a"), "2026-10-16-worker-0000000a");
	assert.throws(() => findJob(home, "0000000a"), { message: /^0000000a matches 2 jobs: 2026-10-1[56]-\w+-0000000a, 2026-10-1[56]-\w+-0000000a; name one by its full id$/ });
	for (const query of ["0000000c", "", "000000b", "../jobs"]) assert.throws(() => findJob(home, query), { message: `${query}: no such job in ${join(home, "jobs")}` });
});

async function worker(jobs: JobRunner, home: string, task = "Go.") {
	const job = await jobs.spawn({ task });
	await finished(home, job.id);
	return job;
}

test("arthur prune frees a merged worker's worktree, branch and record, and keeps what Git refuses to delete, in one line", async () => {
	const { root, home, jobs } = setup();
	const merged = await worker(jobs, home);
	const unmerged = await worker(jobs, home);
	const dirty = await worker(jobs, home);
	git(unmerged.worktree, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "work");
	writeFileSync(join(dirty.worktree, "notes.txt"), "not committed\n");
	const lines = jobs.prune("all");
	assert.equal(lines.length, 3);
	assert.ok(lines.includes(`${dirty.id}: kept its worktree, branch and record: git worktree: fatal: '${dirty.worktree}' contains modified or untracked files, use --force to delete it`), lines.join("\n"));
	assert.ok(lines.includes(`${merged.id}: worktree ${merged.worktree} removed; branch arthur/${merged.id} deleted; record deleted`), lines.join("\n"));
	// Git's own words, which end in a full stop in some versions.
	const kept = `${unmerged.id}: worktree ${unmerged.worktree} removed; kept branch arthur/${unmerged.id} and the record: git branch: error: the branch 'arthur/${unmerged.id}' is not fully merged`;
	assert.ok(lines.some((line) => line === kept || line === `${kept}.`), lines.join("\n"));
	assert.deepEqual([existsSync(join(home, "jobs", merged.id)), existsSync(merged.worktree), git(root, "branch", "--list", `arthur/${merged.id}`)], [false, false, ""]);
	assert.deepEqual([existsSync(join(home, "jobs", unmerged.id)), git(root, "branch", "--list", `arthur/${unmerged.id}`)], [true, `arthur/${unmerged.id}`]);
	assert.deepEqual([existsSync(join(home, "jobs", dirty.id)), existsSync(join(dirty.worktree, "notes.txt"))], [true, true]);
	// Once merged, a second prune finds the worktree gone and deletes the branch and the record.
	git(root, "merge", "--quiet", "--ff-only", `arthur/${unmerged.id}`);
	assert.deepEqual(jobs.prune([unmerged.id.slice(-8)]), [`${unmerged.id}: branch arthur/${unmerged.id} deleted; record deleted`]);
});

test("arthur prune keeps a job's worktree, branch and record while the worktree reads a key that may name a program, from the shared config or its own", async () => {
	const { root, home, jobs } = setup();
	const job = await worker(jobs, home);
	// A file a clean filter reads, as a job's commit leaves it; `git status` in the worktree runs the filter while its stat is stale.
	writeFileSync(join(job.worktree, ".gitattributes"), "a filter=x\n");
	writeFileSync(join(job.worktree, "a"), "a\n");
	git(job.worktree, "add", ".gitattributes", "a");
	git(job.worktree, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "a file");
	const [ran, filter] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "clean")];
	writeFileSync(filter, `#!/bin/sh\necho clean >> '${ran}'\ncat\n`, { mode: 0o755 });
	const old = new Date("2000-01-01");
	const kept = (file: string) => [`${job.id}: kept its worktree, branch and record: git worktree: ${file} sets filter.x.clean, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`];
	const all = () => [existsSync(job.worktree), git(root, "branch", "--list", "--format=%(refname:short)", `arthur/${job.id}`), existsSync(join(home, "jobs", job.id)), existsSync(ran)];
	git(root, "config", "filter.x.clean", filter);
	utimesSync(join(job.worktree, "a"), old, old);
	assert.deepEqual(jobs.prune([job.id]), kept(join(root, ".git", "config")));
	assert.deepEqual(all(), [true, `arthur/${job.id}`, true, false], "the shared config's: everything kept, nothing run");
	// The worktree's own config.worktree, which Git reads once `extensions.worktreeConfig` is on.
	git(root, "config", "--unset", "filter.x.clean");
	git(root, "config", "extensions.worktreeConfig", "true");
	git(job.worktree, "config", "--worktree", "filter.x.clean", filter);
	assert.deepEqual(jobs.prune([job.id]), kept(join(root, ".git", "worktrees", job.id, "config.worktree")));
	assert.deepEqual(all(), [true, `arthur/${job.id}`, true, false], "the worktree's own: everything kept, nothing run");
	git(job.worktree, "status", "--porcelain");
	assert.match(readFileSync(ran, "utf8"), /^clean$/m, "git status in the worktree, which git worktree remove runs, runs it");
	// A worktree gone leaves no `git status` to run: `git worktree prune` takes its place, the key still set.
	rmSync(ran);
	rmSync(job.worktree, { recursive: true, force: true });
	assert.match(jobs.prune([job.id])[0] ?? "", new RegExp(`^${job.id}: kept branch arthur/${job.id} and the record: git branch: `));
	assert.deepEqual(all(), [false, `arthur/${job.id}`, true, false], "the unmerged branch kept, nothing run");
});

test("arthur prune keeps a branch that a replacement of main's tip under refs/replace makes look merged", async () => {
	const { root, home, jobs } = setup();
	const job = await worker(jobs, home);
	git(job.worktree, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "work");
	// Main's tip read as a child of the branch's tip, as a job's git replace would write: `git branch -d` would take it as merged.
	const fake = git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit-tree", "-p", git(job.worktree, "rev-parse", "HEAD"), "-m", "fake", "main^{tree}");
	git(root, "replace", git(root, "rev-parse", "main"), fake);
	assert.match(jobs.prune([job.id]).join("\n"), new RegExp(`kept branch arthur/${job.id} and the record: git branch: error: the branch 'arthur/${job.id}' is not fully merged`));
	assert.equal(git(root, "branch", "--list", `arthur/${job.id}`), `arthur/${job.id}`);
});

test("a spawn and a prune run no hook and no fsmonitor that the repository's shared config names", async () => {
	const { root, home, jobs } = setup();
	// Each hook these steps could run, and an fsmonitor, noting its name in `ran`, as a job's program may have set them.
	const [hooks, ran] = [temporaryFolder(), join(temporaryFolder(), "ran")];
	for (const name of ["post-checkout", "reference-transaction", "fsmonitor"]) writeFileSync(join(hooks, name), `#!/bin/sh\necho ${name} >> '${ran}'\n`, { mode: 0o755 });
	git(root, "config", "core.hooksPath", hooks);
	git(root, "config", "core.fsmonitor", join(hooks, "fsmonitor"));
	const job = await worker(jobs, home);
	assert.deepEqual(jobs.prune([job.id]), [`${job.id}: worktree ${job.worktree} removed; branch arthur/${job.id} deleted; record deleted`]);
	assert.equal(existsSync(ran) ? readFileSync(ran, "utf8") : "", "");
	git(root, "worktree", "add", "--quiet", "-b", "control", join(temporaryFolder(), "control"));
	assert.match(readFileSync(ran, "utf8"), /^reference-transaction$[^]*^post-checkout$/m, "a plain git call runs them");
});

test("a spawn is refused before its checkout while the repository's own config sets a key that may name a program, and runs none", async () => {
	const { root, home, jobs } = setup();
	const [ran, smudge] = [join(temporaryFolder(), "ran"), join(temporaryFolder(), "smudge")];
	writeFileSync(smudge, `#!/bin/sh\necho smudge >> '${ran}'\ncat\n`, { mode: 0o755 });
	// The driver and the attribute that gives every file its filter, both in the shared Git folder a job's program can write.
	writeFileSync(join(root, ".git", "info", "attributes"), "* filter=x\n");
	git(root, "config", "filter.x.smudge", smudge);
	const said = `${join(root, ".git", "config")} sets filter.x.smudge, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	await assert.rejects(jobs.spawn({ task: "Go." }), { message: `no worktree: ${said}` });
	assert.deepEqual([existsSync(ran), git(root, "worktree", "list").split("\n").length, existsSync(join(home, "jobs")) ? readdirSync(join(home, "jobs")) : []], [false, 1, []]);
	git(root, "worktree", "add", "--quiet", "-b", "control", join(temporaryFolder(), "control"));
	assert.equal(readFileSync(ran, "utf8"), "smudge\n", "a plain git call runs it");
	git(root, "config", "--unset", "filter.x.smudge");
	await worker(jobs, home);
});

test("arthur prune keeps a job that has not ended and a record a plugin's jobs.keep asks for; a read-only kind loses its checkout only", async () => {
	const asked: unknown[] = [];
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }), (job) => {
		asked.push(job);
		return (job as { kind: string }).kind === "review" ? "its verdict counts toward the review limit" : 0;
	});
	const review = await jobs.spawn({ task: "Review.", kind: "review" });
	await finished(home, review.id);
	record(home, "2026-10-16-worker-0000000a", { state: "working", root: "/nowhere" }, NOW);
	record(home, "2026-10-16-worker-0000000b", { state: "blocked", reason: "user: may I?" }, NOW);
	record(home, "2026-10-16-worker-0000000c", { state: "ended", reason: "finished" }, NOW);
	assert.deepEqual(jobs.prune(["0000000a", "0000000b", "0000000c", review.id]), [
		"2026-10-16-worker-0000000a: kept: it is working, not ended",
		"2026-10-16-worker-0000000b: kept: it is blocked (user: may I?), not ended",
		"2026-10-16-worker-0000000c: kept: its record names no repository (root)",
		`${review.id}: worktree ${review.worktree} removed; kept the record: its verdict counts toward the review limit`,
	]);
	assert.deepEqual(asked, [{ id: review.id, kind: "review", project: "acme", task: "Review.", state: "ended", reason: "finished", branch: "", worktree: review.worktree }]);
	assert.equal(existsSync(review.worktree), false);
	// A typo refuses the whole prune before anything is removed: a job named before it that a prune would free stays whole.
	const free = await worker(jobs, home);
	assert.throws(() => jobs.prune([free.id, "deadbeef"]), { message: `deadbeef: no such job in ${join(home, "jobs")}` });
	assert.deepEqual([existsSync(join(home, "jobs", free.id)), existsSync(free.worktree)], [true, true]);
	assert.deepEqual(jobs.prune([free.id]), [`${free.id}: worktree ${free.worktree} removed; branch arthur/${free.id} deleted; record deleted`]);
});

test("the runner's prune refuses an empty list and an empty id, and frees nothing: only \"all\" frees every finished job", async () => {
	const { home, jobs } = setup();
	const job = await worker(jobs, home);
	assert.throws(() => jobs.prune([]), { message: 'prune needs one or more ids, or "all" for every finished job' });
	assert.throws(() => jobs.prune([""]), { message: `: no such job in ${join(home, "jobs")}` });
	assert.deepEqual([existsSync(join(home, "jobs", job.id)), existsSync(job.worktree)], [true, true]);
});

test("a plugin's jobs.keep that throws ends the prune with its error, and the job it was asked about keeps its record", async () => {
	const { home, jobs } = setup(fakeAgent({ steps: [{ message: "Done." }] }), () => {
		throw new Error("delivery: the review limit is unreadable");
	});
	const job = await worker(jobs, home);
	assert.throws(() => jobs.prune("all"), { message: "delivery: the review limit is unreadable" });
	assert.deepEqual([existsSync(join(home, "jobs", job.id)), existsSync(job.worktree)], [true, false]);
});

test("the sweep ends a working or idle job whose wrapper and agent are gone on two sweeps in a row, never a blocked one", async (t) => {
	const { home, jobs } = setup();
	// Ids of their own: the sweep looks for the wrapper of an id in the whole process table, where another test run may have one.
	const [id, idle] = [`2026-10-16-worker-${randomBytes(4).toString("hex")}`, `2026-10-16-worker-${randomBytes(4).toString("hex")}`];
	record(home, id, { state: "working", pid: "999999999", log: "" }, NOW);
	record(home, idle, { state: "idle", pid: "999999999", log: "" }, NOW);
	// Ended jobs, a run that ended blocked and a job a plugin holds while its machine is away: never ended, however many sweeps.
	const kept = { "2026-10-16-worker-0000000b": "finished", "2026-10-16-worker-0000000c": "stopped", "2026-10-16-worker-0000000d": "user: may I?", "2026-10-16-worker-0000000e": "dependency: machine mac unreachable" };
	for (const [each, reason] of Object.entries(kept)) record(home, each, { state: reason.includes(":") ? "blocked" : "ended", reason, pid: "999999999" }, NOW);
	writeFileSync(join(home, "jobs", "2026-10-16-worker-0000000e", "hold"), "machine mac unreachable");
	await jobs.sweep();
	assert.equal(field(home, id, "state"), "working", "gone on one sweep");
	// Back on the next sweep: an agent whose command line names the record's prompt.
	const agent = spawn("sh", ["-c", "sleep 30", "--append-system-prompt", join(home, "jobs", id, "prompt")], { stdio: "ignore" });
	t.after(() => agent.kill());
	await until("the agent in the process table", () => execFileSync("ps", ["-A", "-o", "args="], { encoding: "utf8" }).includes(join(home, "jobs", id, "prompt")));
	await jobs.sweep();
	agent.kill();
	await until("the agent gone", () => agent.exitCode !== null || agent.signalCode !== null);
	await jobs.sweep();
	assert.equal(field(home, id, "state"), "working", "gone, back, then gone once more");
	assert.deepEqual(events(home, "job-ended").map((data) => (data as { id: string }).id), [idle]);
	await jobs.sweep();
	assert.deepEqual(["state", "reason"].map((name) => field(home, id, name)), ["ended", "failed: process gone"]);
	assert.deepEqual(Object.keys(kept).map((each) => field(home, each, "reason")), Object.values(kept));
	assert.match(field(home, id, "log"), /^\[arthur [^\]]+\] ended: failed: process gone: its wrapper 999999999 and its agent were not running on two sweeps in a row\n$/);
	assert.deepEqual(events(home, "job-ended").at(-1), { id, kind: "worker", project: "acme", state: "ended", reason: "failed: process gone" });
	assert.deepEqual(events(home, "job-state").at(-1), { id, project: "acme", ticket: null, machine: "local", from: "working", to: "ended", reason: "failed: process gone" });
	await jobs.sweep();
	assert.equal(events(home, "job-ended").length, 2, "an ended job is not swept again");
});

test("the sweep keeps a working job whose wrapper runs before it wrote its pid; a process that names the wrapper before the id is none; its end removes the MCP secrets", async (t) => {
	const { home, jobs } = setup();
	const id = `2026-10-16-worker-${randomBytes(4).toString("hex")}`;
	record(home, id, { state: "working", log: "" }, NOW);
	const secrets = join(home, "jobs", id, "mcp", ".mcp.json");
	mkdirSync(dirname(secrets));
	writeFileSync(secrets, '{ "mcpServers": { "docs": { "env": { "TOKEN": "s3cret" } } } }\n');
	const wrapper = join(import.meta.dirname, "..", "src", "wrapper.ts");
	const lone = (...args: string[]) => spawn(process.execPath, ["-e", "setTimeout(() => {}, 300_000)", ...args], { stdio: "ignore" });
	// The wrapper's command line as `launch` starts it, and `arthur continue <id> <instruction>` whose instruction names it.
	const [starting, decoy] = [lone(wrapper, home, id, "omp"), lone("continue", id, "fix", wrapper, "now")];
	t.after(() => [starting, decoy].forEach((child) => child.kill()));
	await until("both in the process table", () => execFileSync("ps", ["-A", "-o", "pid="], { encoding: "utf8" }).split("\n").filter((pid) => [starting.pid, decoy.pid].includes(Number(pid))).length === 2);
	await jobs.sweep();
	await jobs.sweep();
	assert.deepEqual([field(home, id, "state"), existsSync(secrets)], ["working", true], "its wrapper runs");
	starting.kill();
	await until("the wrapper gone", () => starting.exitCode !== null || starting.signalCode !== null);
	await jobs.sweep();
	await jobs.sweep();
	assert.deepEqual(["state", "reason"].map((name) => field(home, id, name)), ["ended", "failed: process gone"]);
	assert.match(field(home, id, "log"), /its wrapper \(no pid\) and its agent were not running on two sweeps in a row\n$/);
	assert.equal(existsSync(join(home, "jobs", id, "mcp")), false);
});

test("/stopall stops every running job, one line each, and emits stop-all; with nothing running it says so", async () => {
	const { home, jobs, commands } = setup(fakeAgent({ steps: [{ waitFor: join(temporaryFolder(), "never") }] }));
	assert.equal(await commands.route("/stopall"), "no running jobs");
	const [one, two] = [await jobs.spawn({ task: "Go." }), await jobs.spawn({ task: "Go." })];
	for (const job of [one, two]) await until("working", () => field(home, job.id, "state") === "working");
	assert.deepEqual((await commands.route("/stopall")).split("\n").toSorted(), [`${one?.id}: stopped`, `${two?.id}: stopped`].toSorted());
	assert.deepEqual(events(home, "stop-all"), [{ ids: [] }, { ids: [two?.id, one?.id] }]);
});

test("/steer <id> <text> steers a running job by its short id; /jobs lists; wrong usage gets the usage", async () => {
	const { home, jobs, commands } = setup(fakeAgent({ steps: [{ waitFor: join(temporaryFolder(), "never") }] }));
	const job = await jobs.spawn({ task: "Go." });
	await until("working", () => field(home, job.id, "state") === "working");
	assert.equal(await commands.route(`/steer ${job.id.slice(-8)} Mind the tests.\nAll of them.`), `${job.id}: steer 0001 queued for after its next tool call`);
	assert.equal(readFileSync(join(home, "jobs", job.id, "steer", "inbox", "0001"), "utf8"), "Mind the tests.\nAll of them.\n");
	for (const text of ["/steer", `/steer ${job.id}`, `/steer ${job.id}   `]) assert.equal(await commands.route(text), "usage: /steer <id> <text>");
	assert.equal(await commands.route("/steer deadbeef x"), `/steer failed: deadbeef: no such job in ${join(home, "jobs")}`);
	assert.match(await commands.route("/jobs"), new RegExp(`^working\\n-  worker  working  0h00m  \\$0\\.00/\\$2\\.00  ${job.id.slice(-8)}$`));
	await commands.route("/stopall");
});

test("a steer, by arthur steer or /steer, and a continue that started emit job-steered with the job's id, kind, text and how; a refused one emits nothing", async () => {
	const gate = join(temporaryFolder(), "gate");
	const { home, jobs, commands } = setup(fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }));
	const job = await jobs.spawn({ task: "Go." });
	await until("working", () => field(home, job.id, "state") === "working");
	assert.equal((await command(commands, "steer", job.id.slice(-8), "Mind the tests.")).code, 0);
	assert.equal(await commands.route(`/steer ${job.id} Use a timeout of 1800.\nAlways.`), `${job.id}: steer 0002 queued for after its next tool call`);
	await assert.rejects(command(commands, "continue", job.id, "Go on."), /in a run/);
	writeFileSync(gate, "");
	await finished(home, job.id);
	await assert.rejects(command(commands, "steer", job.id, "Too late."), /not in a run/);
	assert.deepEqual(await command(commands, "continue", job.id, "Fix the README."), { code: 0, out: `${job.id}: continued`, err: "" });
	assert.deepEqual(events(home, "job-steered"), [
		{ id: job.id, kind: "worker", text: "Mind the tests.", via: "steer" },
		{ id: job.id, kind: "worker", text: "Use a timeout of 1800.\nAlways.", via: "steer" },
		{ id: job.id, kind: "worker", text: "Fix the README.", via: "continue" },
	]);
	await until("the continued run's end", () => events(home, "job-ended").length === 2);
	// A record without its `timeout` makes the wrapper exit before it writes its pid: the continue did not start.
	rmSync(join(home, "jobs", job.id, "timeout"));
	assert.equal((await command(commands, "continue", job.id, "Once more.")).code, 1);
	assert.equal(events(home, "job-steered").length, 3, "a continue whose wrapper did not start");
});

test("the arthur binary lists, stops, steers, continues and prunes a job by its short id; arguments where none go exit 2", async () => {
	const { root } = setup();
	writeFileSync(join(root, ".gitignore"), ".arthur/\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "ignore");
	const agent = fakeAgent({ steps: [{ waitFor: join(temporaryFolder(), "never") }] });
	writeFileSync(join(root, "arthur.config.ts"), `export default { core: { timeZone: "UTC", agent: { command: ${JSON.stringify(agent)} } }, plugins: [{ name: "orchestration", setup() {} }] };\n`);
	const cli = join(import.meta.dirname, "..", "src", "cli.ts");
	const arthur = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, ARTHUR_JOB_SLICE: jobSlice.slice } });
	const id = arthur("spawn", "Go.").stdout.trim();
	const short = id.slice(-8);
	await until("working", () => existsSync(join(root, ".arthur", "jobs", id, "state")) && field(join(root, ".arthur"), id, "state") === "working");
	assert.match(arthur("jobs").stdout, new RegExp(`^working\\n-  worker  working  \\dh\\d\\dm  \\$0\\.00/\\$2\\.00  ${short}\\n$`));
	assert.equal(arthur("jobs", "--state", "idle").stdout, "no idle jobs\n");
	assert.equal(arthur("steer", short, "Mind the tests.").stdout, `${id}: steer 0001 queued for after its next tool call\n`);
	assert.equal(arthur("stop", short).stdout, `${id}: stopped\n`);
	assert.equal(arthur("continue", short, "Go on.").stdout, `${id}: continued\n`);
	assert.deepEqual(events(join(root, ".arthur"), "job-steered"), [{ id, kind: "worker", text: "Mind the tests.", via: "steer" }, { id, kind: "worker", text: "Go on.", via: "continue" }]);
	assert.equal(arthur("stopall").stdout, `${id}: stopped\n`);
	assert.equal(arthur("prune", short).stdout, `${id}: worktree ${join(root, "..", ".arthur-worktrees", id)} removed; branch arthur/${id} deleted; record deleted\n`);
	for (const [args, problem] of [
		[["jobs", "all"], "expected no arguments, got 1 arguments\nusage: arthur jobs [--state <state>]"],
		[["jobs", "--state", "running"], "--state needs one of blocked, working, idle, ended, got running\nusage: arthur jobs [--state <state>]"],
		[["jobs", "--state"], "--state needs a value\nusage: arthur jobs [--state <state>]"],
		[["jobs", "--state", "idle", "--state", "ended"], "--state given twice\nusage: arthur jobs [--state <state>]"],
		[["stopall", "now"], "expected no arguments, got 1 arguments\nusage: arthur stopall"],
		[["prune", "--force"], "unknown flag --force\nusage: arthur prune (<id>... | --all)"],
	] as const) assert.deepEqual([arthur(...args).status, arthur(...args).stderr], [2, `arthur ${args[0]}: ${problem}\n`]);
	const refused = arthur("prune", "deadbeef");
	assert.deepEqual([refused.status, refused.stderr], [1, `arthur prune: deadbeef: no such job in ${join(root, ".arthur", "jobs")}\n`]);
});

// Runs a job command in-process; what it prints and what it refuses are captured, its exit code kept.
async function command(commands: CommandRegistry, name: string, ...args: string[]) {
	const out: string[] = [];
	const err: string[] = [];
	const log = mock.method(console, "log", (line = "") => {
		out.push(String(line));
	});
	const error = mock.method(console, "error", (line = "") => {
		err.push(String(line));
	});
	try {
		const found = commands.find(name);
		assert.ok(found, name);
		const code = await found.run({ args, project: undefined });
		return { code: typeof code === "number" ? code : 0, out: out.join("\n"), err: err.join("\n") };
	} finally {
		log.mock.restore();
		error.mock.restore();
	}
}

test("arthur prune with no ids refuses with the usage line and exit 2; two finished jobs are both kept", async () => {
	const { home, jobs, commands } = setup();
	const first = await worker(jobs, home);
	const second = await worker(jobs, home);
	assert.deepEqual(await command(commands, "prune"), { code: 2, out: "", err: "arthur prune: needs one or more ids, or --all for every finished job\nusage: arthur prune (<id>... | --all)" });
	assert.deepEqual([existsSync(join(home, "jobs", first.id)), existsSync(first.worktree), existsSync(join(home, "jobs", second.id)), existsSync(second.worktree)], [true, true, true, true]);
});

test("arthur prune --all frees every finished job as the bare prune did; --all with ids is refused with exit 2 and frees nothing", async () => {
	const { home, jobs, commands } = setup();
	const first = await worker(jobs, home);
	const second = await worker(jobs, home);
	assert.deepEqual(await command(commands, "prune", first.id, "--all"), { code: 2, out: "", err: "arthur prune: --all takes no ids\nusage: arthur prune (<id>... | --all)" });
	assert.deepEqual([existsSync(join(home, "jobs", first.id)), existsSync(join(home, "jobs", second.id))], [true, true]);
	const freed = await command(commands, "prune", "--all");
	assert.equal(freed.code, 0);
	assert.deepEqual(freed.out.split("\n").sort(), [
		`${first.id}: worktree ${first.worktree} removed; branch arthur/${first.id} deleted; record deleted`,
		`${second.id}: worktree ${second.worktree} removed; branch arthur/${second.id} deleted; record deleted`,
	].sort());
	assert.deepEqual([existsSync(join(home, "jobs", first.id)), existsSync(join(home, "jobs", second.id))], [false, false]);
});

test("an empty id is refused with exit 2 before anything is removed, even beside a real id", async () => {
	const { home, jobs, commands } = setup();
	const free = await worker(jobs, home);
	assert.deepEqual(await command(commands, "prune", free.id, ""), { code: 2, out: "", err: "arthur prune: an empty id or text\nusage: arthur prune (<id>... | --all)" });
	assert.deepEqual([existsSync(join(home, "jobs", free.id)), existsSync(free.worktree)], [true, true]);
});

test("stop with an empty id is refused with exit 2 before it acts; the job is not touched", async () => {
	const { home, jobs, commands } = setup();
	const job = await worker(jobs, home);
	assert.deepEqual(await command(commands, "stop", ""), { code: 2, out: "", err: "arthur stop: an empty id or text\nusage: arthur stop <id>" });
	assert.equal(field(home, job.id, "state"), "ended");
});

test("steer with an empty id or an empty text is refused with exit 2 before it acts; no steer is queued", async () => {
	const { home, jobs, commands } = setup();
	const job = await worker(jobs, home);
	assert.deepEqual(await command(commands, "steer", job.id, ""), { code: 2, out: "", err: "arthur steer: an empty id or text\nusage: arthur steer <id> <text>" });
	assert.deepEqual(await command(commands, "steer", "", "Mind the tests."), { code: 2, out: "", err: "arthur steer: an empty id or text\nusage: arthur steer <id> <text>" });
	assert.equal(existsSync(join(home, "jobs", job.id, "steer", "inbox", "0001")), false);
});

test("continue with an empty id or an empty instruction is refused with exit 2; the ended job's record is left as it was", async () => {
	const { home, jobs, commands } = setup();
	const job = await worker(jobs, home);
	assert.deepEqual(await command(commands, "continue", job.id, ""), { code: 2, out: "", err: "arthur continue: an empty id or text\nusage: arthur continue <id> <instruction> [--budget <usd> [--decision <id>]] [--ignore-restart]" });
	assert.deepEqual(await command(commands, "continue", "", "Go on."), { code: 2, out: "", err: "arthur continue: an empty id or text\nusage: arthur continue <id> <instruction> [--budget <usd> [--decision <id>]] [--ignore-restart]" });
	assert.equal(field(home, job.id, "state"), "ended");
});

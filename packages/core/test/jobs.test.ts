import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { clock } from "../src/clock.ts";
import { readEvents } from "../src/event-log.ts";
import { eventBus } from "../src/events.ts";
import { type JobRunner, jobRunner } from "../src/jobs.ts";
import { temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// A repository `<folder>/acme` with one commit of `files`, and a home folder beside it.
function repository(files: Readonly<Record<string, string>> = { "README.md": "acme\n" }): { readonly root: string; readonly home: string } {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	return { root, home: join(folder, "home") };
}

// A runner whose clock reads 2026-10-16 in Warsaw, 23:30 UTC the evening before.
function runner(home: string, root: string): JobRunner {
	const time = clock("Europe/Warsaw", undefined, () => new Date("2026-10-15T23:30:00Z"));
	return jobRunner(home, root, { timeoutMinutes: 120, budgetUsd: 2 }, time, eventBus(home), () => []);
}

const record = (home: string, id: string) =>
	Object.fromEntries(readdirSync(join(home, "jobs", id)).map((name) => [name, readFileSync(join(home, "jobs", id, name), "utf8")]));
const branches = (root: string) => git(root, "branch", "--list", "--format=%(refname:short)").split("\n");

test("a worker gets its own branch and worktree from HEAD, the record and job-started", async () => {
	const { root, home } = repository();
	const job = await runner(home, root).spawn({ task: "Fix the README.", model: "anthropic/opus", thinking: "high" });
	assert.match(job.id, /^2026-10-16-worker-[0-9a-f]{8}$/);
	const worktree = join(dirname(root), ".arthur-worktrees", job.id);
	assert.deepEqual([job.branch, job.worktree, job.root, job.project], [`arthur/${job.id}`, worktree, root, "acme"]);
	assert.equal(git(worktree, "branch", "--show-current"), `arthur/${job.id}`);
	assert.equal(git(worktree, "rev-parse", "HEAD"), git(root, "rev-parse", "HEAD"));
	assert.equal(readFileSync(join(worktree, "README.md"), "utf8"), "acme\n");
	assert.deepEqual(record(home, job.id), {
		task: "Fix the README.",
		kind: "worker",
		model: "anthropic/opus",
		thinking: "high",
		timeout: "120",
		budget: "2",
		branch: `arthur/${job.id}`,
		root,
		worktree,
		project: "acme",
		prompt: readFileSync(new URL("../roles/worker.md", import.meta.url), "utf8"),
	});
	assert.deepEqual(readdirSync(join(home, "jobs")), [job.id]);
	const events = readEvents(home, 1).map(({ plugin, name, data }) => ({ plugin, name, data }));
	const data = { id: job.id, kind: "worker", project: "acme", root, branch: `arthur/${job.id}`, worktree, tickets: [] };
	assert.deepEqual(events, [{ plugin: "core", name: "job-started", data }]);
});

test("a read-only kind gets a detached checkout of HEAD, no branch, and its own limits", async () => {
	const { root, home } = repository();
	const jobs = runner(home, root);
	const role = join(temporaryFolder(), "reviewer.md");
	writeFileSync(role, "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(role), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer", budgetUsd: 0.5, timeoutMinutes: 30 });
	const job = await jobs.spawn({ task: "Review it.", kind: "review" });
	assert.match(job.id, /^2026-10-16-review-[0-9a-f]{8}$/);
	assert.equal(job.branch, undefined);
	assert.equal(git(job.worktree, "branch", "--show-current"), "");
	assert.equal(git(job.worktree, "rev-parse", "HEAD"), git(root, "rev-parse", "HEAD"));
	assert.deepEqual(branches(root), ["main"]);
	const { branch, model, thinking, timeout, budget, kind } = record(home, job.id);
	assert.deepEqual({ branch, model, thinking, timeout, budget, kind }, { branch: "", model: "", thinking: "", timeout: "30", budget: "0.5", kind: "review" });
});

test("uncommitted changes stay in the main checkout and are not in the job", async () => {
	const { root, home } = repository({ "README.md": "acme\n", "staged.md": "one\n" });
	writeFileSync(join(root, "README.md"), "changed\n");
	writeFileSync(join(root, "staged.md"), "two\n");
	git(root, "add", "staged.md");
	writeFileSync(join(root, "new.md"), "untracked\n");
	const before = git(root, "status", "--porcelain");
	const job = await runner(home, root).spawn({ task: "Go." });
	assert.equal(git(root, "status", "--porcelain"), before);
	assert.equal(readFileSync(join(root, "README.md"), "utf8"), "changed\n");
	assert.equal(readFileSync(join(job.worktree, "README.md"), "utf8"), "acme\n");
	assert.equal(readFileSync(join(job.worktree, "staged.md"), "utf8"), "one\n");
	assert.equal(existsSync(join(job.worktree, "new.md")), false);
	assert.equal(git(job.worktree, "status", "--porcelain"), "");
});

// Nothing of a job exists: no record, no worktree, no branch but `names` (main), no event.
function nothingMade(root: string, home: string, names: readonly string[] = ["main"]): void {
	assert.equal(existsSync(join(home, "jobs")) && readdirSync(join(home, "jobs")).length > 0, false, "a record");
	assert.equal(existsSync(join(dirname(root), ".arthur-worktrees")) && readdirSync(join(dirname(root), ".arthur-worktrees")).length > 0, false, "a worktree");
	assert.deepEqual(branches(root), names);
	assert.deepEqual(git(root, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
	assert.deepEqual(readEvents(home, 1), []);
}

test("an unknown kind, an empty task and an unknown project are refused before anything exists", async () => {
	const { root, home } = repository();
	const jobs = runner(home, root);
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	await assert.rejects(jobs.spawn({ task: "Go.", kind: "audit" }), { message: "unknown kind audit; kinds: review, worker" });
	await assert.rejects(jobs.spawn({ task: " \n" }), { message: "the task is empty" });
	await assert.rejects(jobs.spawn({ task: "Go.", project: "other" }), { message: "unknown project other; the only project is acme" });
	nothingMade(root, home);
	assert.equal((await jobs.spawn({ task: "Go.", project: "acme" })).project, "acme");
});

test("every Ticket: file the task names must be in HEAD; the missing ones are named and nothing is made", async () => {
	const ticket = "spec/features/AC0001-one/ticket.md";
	const { root, home } = repository({ [ticket]: "# AC0001\n", "spec/features/AC0002-two/notes.md": "x\n" });
	const jobs = runner(home, root);
	mkdirSync(join(root, "spec/features/AC0003-new"));
	writeFileSync(join(root, "spec/features/AC0003-new/ticket.md"), "# not committed\n");
	const message = (missing: string) => ({ message: `Ticket: ${missing}: no such file at HEAD (${git(root, "rev-parse", "--short=7", "HEAD")}); commit it first` });
	await assert.rejects(jobs.spawn({ task: "Ticket: spec/features/AC0003-new/ticket.md. Build it." }), message("spec/features/AC0003-new/ticket.md"));
	await assert.rejects(jobs.spawn({ task: `Ticket: ${ticket}, and Ticket: spec/features/AC0002-two.` }), message("spec/features/AC0002-two"));
	await assert.rejects(jobs.spawn({ task: "Ticket: `spec/x.md`; Ticket: ../acme/README.md" }), message("spec/x.md, ../acme/README.md"));
	nothingMade(root, home);
	const job = await jobs.spawn({ task: `Ticket: \`${ticket}\`. Again, Ticket: ${ticket}!` });
	assert.deepEqual(job.tickets, [ticket]);
	assert.deepEqual((readEvents(home, 1)[0]?.data as { tickets: unknown }).tickets, [ticket]);
});

test("a beforeSpawn reason, or a check that throws, refuses with the plugin's name before anything exists", async () => {
	const { root, home } = repository();
	const jobs = runner(home, root);
	const seen: unknown[] = [];
	jobs.beforeSpawn("orchestration", (spawn) => void seen.push(spawn));
	jobs.beforeSpawn("session", async (spawn) => (spawn.task.includes("late") ? "restart due: abc1234" : undefined));
	jobs.beforeSpawn("resources", (spawn) => {
		if (spawn.task.includes("crash")) throw new Error("no machine check yet");
		return undefined;
	});
	await assert.rejects(jobs.spawn({ task: "Too late.", model: "m" }), { message: "refused by session: restart due: abc1234" });
	await assert.rejects(jobs.spawn({ task: "Let it crash." }), { message: "plugin resources: beforeSpawn failed: no machine check yet" });
	nothingMade(root, home);
	const spawn = { task: "Too late.", kind: "worker", project: "acme", model: "m", thinking: undefined, timeoutMinutes: 120, budgetUsd: 2, tickets: [] };
	assert.deepEqual(seen[0], spawn);
	await jobs.spawn({ task: "Go." });
	assert.equal(seen.length, 3);
});

test("prepare runs after the worktree and the record exist, before job-started; one that throws removes both", async () => {
	const { root, home } = repository();
	const jobs = runner(home, root);
	const seen: string[] = [];
	jobs.prepare("commit-rules", (job) => {
		seen.push(`${existsSync(join(job.worktree, "README.md"))} ${readFileSync(join(home, "jobs", job.id, "task"), "utf8")} ${readEvents(home, 1).length}`);
		writeFileSync(join(job.worktree, ".git-hook"), "placed");
	});
	jobs.prepare("docker", async (job) => {
		if (job.task.includes("docker")) throw new Error("docker not found");
	});
	await assert.rejects(jobs.spawn({ task: "Use docker." }), {
		message: "plugin docker: prepare failed: docker not found; the job's worktree and record were removed",
	});
	assert.deepEqual(seen, ["true Use docker. 0"]);
	nothingMade(root, home);
	const job = await jobs.spawn({ task: "Go." });
	assert.equal(readFileSync(join(job.worktree, ".git-hook"), "utf8"), "placed");
	assert.deepEqual(readEvents(home, 1).map((event) => event.name), ["job-started"]);
});

test("node_modules is copied when the lockfile is the same, links kept as they are; not when it differs or is missing", async () => {
	const { root, home } = repository({ "package-lock.json": '{"v":1}\n', "packages/core/package.json": "{}\n" });
	mkdirSync(join(root, "node_modules/@acme"), { recursive: true });
	mkdirSync(join(root, "node_modules/left-pad"));
	writeFileSync(join(root, "node_modules/left-pad/index.js"), "module.exports = 1;\n");
	symlinkSync("../../packages/core", join(root, "node_modules/@acme/core"));
	const jobs = runner(home, root);
	const same = await jobs.spawn({ task: "Go." });
	assert.equal(readFileSync(join(same.worktree, "node_modules/left-pad/index.js"), "utf8"), "module.exports = 1;\n");
	assert.equal(readlinkSync(join(same.worktree, "node_modules/@acme/core")), "../../packages/core");
	assert.equal(readFileSync(join(same.worktree, "node_modules/@acme/core/package.json"), "utf8"), "{}\n");
	writeFileSync(join(root, "package-lock.json"), '{"v":2}\n');
	assert.equal(existsSync(join((await jobs.spawn({ task: "Go." })).worktree, "node_modules")), false);
	const bare = repository();
	mkdirSync(join(bare.root, "node_modules/left-pad"), { recursive: true });
	assert.equal(existsSync(join((await runner(bare.home, bare.root).spawn({ task: "Go." })).worktree, "node_modules")), false);
});

test("a branch, worktree or record that exists already under a drawn id makes the spawn draw another", async (t) => {
	const { root, home } = repository();
	git(root, "branch", "arthur/2026-10-16-worker-00000000");
	mkdirSync(join(dirname(root), ".arthur-worktrees/2026-10-16-worker-01010101"), { recursive: true });
	mkdirSync(join(home, "jobs/2026-10-16-worker-02020202"), { recursive: true });
	let draw = 0;
	t.mock.method(crypto, "getRandomValues", (array: Uint8Array) => array.fill(draw++));
	const job = await runner(home, root).spawn({ task: "Go." });
	t.mock.restoreAll();
	assert.equal(job.id, "2026-10-16-worker-03030303");
	assert.equal(git(root, "rev-parse", "arthur/2026-10-16-worker-00000000"), git(root, "rev-parse", "main"));
	assert.deepEqual(readdirSync(join(home, "jobs")).sort(), ["2026-10-16-worker-02020202", job.id]);
});

test("two spawns at once get distinct ids, branches and worktrees", async () => {
	const { root, home } = repository();
	const jobs = runner(home, root);
	const [one, two] = await Promise.all([jobs.spawn({ task: "One." }), jobs.spawn({ task: "Two." })]);
	assert.notEqual(one?.id, two?.id);
	assert.deepEqual(branches(root).sort(), [`arthur/${one?.id}`, `arthur/${two?.id}`, "main"].sort());
	assert.equal(readFileSync(join(home, "jobs", one?.id ?? "", "task"), "utf8"), "One.");
});

test("a branch named arthur refuses a worker before anything exists, naming the fix; a read-only kind still spawns", async () => {
	const { root, home } = repository();
	git(root, "branch", "arthur");
	const jobs = runner(home, root);
	const role = join(temporaryFolder(), "reviewer.md");
	writeFileSync(role, "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(role), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	const seen: string[] = [];
	jobs.beforeSpawn("delivery", () => void seen.push("checked"));
	await assert.rejects(jobs.spawn({ task: "Go." }), {
		message: `${root} has a branch named arthur, so Git cannot create a worker's branch arthur/<id> beside it; rename it: git branch -m arthur <new-name>`,
	});
	nothingMade(root, home, ["arthur", "main"]);
	assert.deepEqual(seen, []);
	const job = await jobs.spawn({ task: "Review it.", kind: "review" });
	assert.equal(job.branch, undefined);
	assert.ok(existsSync(job.worktree));
});

test("a folder outside Git and a repository with no commit are refused", async () => {
	const outside = temporaryFolder();
	await assert.rejects(runner(join(outside, "home"), outside).spawn({ task: "Go." }), {
		message: `${outside} is not in a Git repository; a job starts from its HEAD`,
	});
	const empty = join(temporaryFolder(), "empty");
	mkdirSync(empty);
	git(empty, "init", "--quiet");
	await assert.rejects(runner(join(empty, ".arthur"), empty).spawn({ task: "Go." }), { message: `${empty} has no commit yet; a job starts from HEAD` });
});

test("registerKind refuses a kind registered twice, a bad name and a readOnly that is not a boolean", () => {
	const { root, home } = repository();
	const jobs = runner(home, root);
	assert.throws(() => jobs.registerKind("delivery", { name: "worker", readOnly: true, role: "worker" }), {
		message: "kind worker: registered by core and by delivery; a kind belongs to one plugin",
	});
	assert.throws(() => jobs.registerKind("delivery", { name: "Review", readOnly: true, role: "reviewer" }), {
		message: 'kind "Review": expected a name of lowercase letters, digits and dashes',
	});
	const loose = { name: "plan", readOnly: "yes", role: "planner" } as unknown as { name: string; readOnly: boolean; role: string };
	assert.throws(() => jobs.registerKind("orchestration", loose), { message: "kind plan: readOnly must be true or false" });
});

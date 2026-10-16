import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { readEvents } from "../src/event-log.ts";
import { temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const USAGE = "usage: arthur spawn <task> [--kind <name>] [--model <model>] [--thinking <level>]";

// A plugin as a config holds it: it owns the kind `review` and its role, refuses a task that says "refuse", places a file in
// every new worktree, failing on a task that says "break", and provides the repository as the one project, prefix AC.
const CONFIG = `import { writeFileSync } from "node:fs";
export default { core: { timeZone: "UTC", jobs: { budgetUsd: 3 } }, plugins: [{ name: "orchestration", setup(host) {
	host.jobs.registerRole({ name: "reviewer", file: new URL("./reviewer.md", import.meta.url), criteria: [] });
	host.jobs.registerKind({ name: "review", readOnly: true, role: "reviewer", timeoutMinutes: 15 });
	host.jobs.beforeSpawn((spawn) => (spawn.task.includes("refuse") ? "maxAgents 3 reached" : undefined));
	host.jobs.prepare(async (job) => {
		if (job.task.includes("break")) throw new Error("no hook");
		writeFileSync(job.worktree + "/.placed", job.id);
	});
	host.provide("projects", () => [{ name: "acme", path: import.meta.dirname, prefix: "AC" }]);
} }] };
`;

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// A repository holding the config and a committed ticket, planned on the board; its home folder is `.arthur/` inside it, as by default.
function repository(config = CONFIG): string {
	const root = join(temporaryFolder(), "acme");
	mkdirSync(join(root, "spec/features/AC0001-one"), { recursive: true });
	writeFileSync(join(root, "spec/features/AC0001-one/ticket.md"), "# AC0001\n");
	writeFileSync(join(root, "spec/build.json"), JSON.stringify([{ id: "AC0001", title: "One", status: "planned", path: "spec/features/AC0001-one/ticket.md", updated: "2026-10-16T00:00:00Z" }]));
	writeFileSync(join(root, ".gitignore"), ".arthur/\n");
	git(dirname(root), "init", "--quiet", "--initial-branch=main", root);
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	writeFileSync(join(root, "arthur.config.ts"), config);
	writeFileSync(join(root, "reviewer.md"), "# Reviewer\n");
	return root;
}

function arthur(root: string, ...args: string[]): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
	return spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
}

const jobs = (root: string) => (existsSync(join(root, ".arthur/jobs")) ? readdirSync(join(root, ".arthur/jobs")) : []);

test("arthur spawn prints the id of a worker on its own branch, with the record and job-started", () => {
	const root = repository();
	const run = arthur(root, "spawn", "Ticket: spec/features/AC0001-one/ticket.md. Build it.", "--model", "anthropic/opus");
	const warning = "warning: criteria file .agents/arthur/criteria/styleguide.md is missing; the worker goes without it\n";
	assert.deepEqual([run.status, run.stderr], [0, warning]);
	const id = run.stdout.trim();
	assert.match(run.stdout, /^\d{4}-\d\d-\d\d-worker-[0-9a-f]{8}\n$/);
	const worktree = join(dirname(root), ".arthur-worktrees", id);
	assert.equal(git(worktree, "branch", "--show-current"), `arthur/${id}`);
	assert.equal(readFileSync(join(worktree, ".placed"), "utf8"), id);
	const field = (name: string) => readFileSync(join(root, ".arthur/jobs", id, name), "utf8");
	assert.deepEqual(["model", "budget", "timeout", "project", "worktree"].map(field), ["anthropic/opus", "3", "120", "acme", worktree]);
	const [started] = readEvents(join(root, ".arthur"), 1);
	assert.deepEqual([started?.name, (started?.data as { id: string }).id], ["job-started", id]);
});

test("--kind review makes a detached checkout with the kind's limits", () => {
	const root = repository();
	const run = arthur(root, "spawn", "--kind", "review", "Review it.");
	assert.equal(run.status, 0, run.stderr);
	const id = run.stdout.trim();
	assert.match(id, /-review-[0-9a-f]{8}$/);
	assert.equal(git(join(dirname(root), ".arthur-worktrees", id), "branch", "--show-current"), "");
	assert.deepEqual(["branch", "timeout"].map((name) => readFileSync(join(root, ".arthur/jobs", id, name), "utf8")), ["", "15"]);
});

test("refusals print the reason, exit 1 and leave no record, worktree or branch", () => {
	const root = repository();
	writeFileSync(join(root, "spec/features/AC0001-one/new.md"), "not committed\n");
	const head = git(root, "rev-parse", "--short=7", "HEAD");
	for (const [args, reason] of [
		[["Please refuse."], "refused by orchestration: maxAgents 3 reached"],
		[["Go.", "--kind", "audit"], "unknown kind audit; kinds: review, worker"],
		[["Ticket: spec/features/AC0001-one/new.md"], `Ticket: spec/features/AC0001-one/new.md: no such file at HEAD (${head}); commit it first`],
		[["Go.", "--project", "other"], "unknown project other; the only project is acme"],
		[["Now break."], "plugin orchestration: prepare failed: no hook; the job's worktree and record were removed"],
	] as const) {
		const run = arthur(root, "spawn", ...args);
		assert.deepEqual([run.status, run.stdout, run.stderr], [1, "", `arthur spawn: ${reason}\n`], args.join(" "));
	}
	assert.deepEqual(jobs(root), []);
	assert.equal(existsSync(join(dirname(root), ".arthur-worktrees")) && readdirSync(join(dirname(root), ".arthur-worktrees")).length > 0, false);
	assert.equal(git(root, "branch", "--list"), "* main");
	assert.deepEqual(readEvents(join(root, ".arthur"), 1), []);
});

test("wrong usage prints the usage line and exits 2", () => {
	const root = repository();
	for (const [args, problem] of [
		[[], "no task"],
		[["a", "b"], "one task, quoted; got 2 arguments"],
		[["Go.", "--budget", "3"], "unknown flag --budget"],
		[["Go.", "--kind"], "--kind needs a value"],
		[["Go.", "--model", ""], "--model needs a value"],
		[["Go.", "--kind", "--model", "m"], "--kind needs a value"],
		[["Go.", "--model", "a", "--model", "b"], "--model given twice"],
	] as const) {
		const run = arthur(root, "spawn", ...args);
		assert.deepEqual([run.status, run.stdout, run.stderr], [2, "", `arthur spawn: ${problem}\n${USAGE}\n`], args.join(" "));
	}
	assert.deepEqual(jobs(root), []);
});

test("a config that does not load refuses the spawn with the reason", () => {
	const root = repository(CONFIG.replace('"orchestration"', '"schedule"'));
	const run = arthur(root, "spawn", "Go.");
	assert.equal(run.status, 1);
	assert.match(run.stderr, /^arthur spawn: arthur\.config\.ts did not load:\n.*orchestration is required and missing/);
	assert.deepEqual(jobs(root), []);
});

test("two arthur spawn processes at once get distinct ids, branches and worktrees", async () => {
	const root = repository();
	const once = () =>
		new Promise<string>((resolve, reject) => {
			const child = spawn(process.execPath, [CLI, "spawn", "Go."], { cwd: root, env: { PATH: process.env.PATH ?? "" } });
			let out = "";
			child.stdout.on("data", (chunk) => (out += chunk));
			child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`exit ${code}`))));
		});
	const ids = await Promise.all([once(), once(), once()]);
	assert.equal(new Set(ids).size, 3);
	assert.deepEqual(jobs(root).sort(), [...ids].sort());
	assert.deepEqual(git(root, "branch", "--list", "arthur/*", "--format=%(refname:short)").split("\n").sort(), ids.map((id) => `arthur/${id}`).sort());
	for (const id of ids) assert.equal(git(join(dirname(root), ".arthur-worktrees", id), "branch", "--show-current"), `arthur/${id}`);
});

test("a worker's start moves its ticket to in-progress, other kinds' do not; a move the board refuses is said, and the job goes on", () => {
	const root = repository();
	const task = "Ticket: spec/features/AC0001-one/ticket.md. Build it.";
	const warning = "warning: criteria file .agents/arthur/criteria/styleguide.md is missing; the worker goes without it\n";
	const status = () => JSON.parse(readFileSync(join(root, "spec/build.json"), "utf8"))[0].status;
	assert.deepEqual(arthur(root, "spawn", "--kind", "review", task).stderr, "");
	assert.equal(status(), "planned");
	for (const _ of [1, 2]) assert.deepEqual(arthur(root, "spawn", task).stderr, warning);
	assert.equal(status(), "in-progress");
	const moves = readEvents(join(root, ".arthur"), 1).filter((event) => event.name === "ticket-moved");
	assert.deepEqual(moves.map(({ plugin, data }) => [plugin, data]), [["core", { id: "AC0001", project: "acme", from: "planned", to: "in-progress" }]]);
	writeFileSync(join(root, "spec/build.json"), readFileSync(join(root, "spec/build.json"), "utf8").replace('"in-progress"', '"merged"'));
	const run = arthur(root, "spawn", task);
	const seq = readEvents(join(root, ".arthur"), 1).at(-1)?.seq;
	assert.deepEqual(
		[run.status, run.stderr],
		[0, `plugin core: handler of job-started (event ${seq}) failed: AC0001: merged cannot move to in-progress; from merged: none, it is final\n${warning}`],
	);
	assert.equal(status(), "merged");
	assert.equal(jobs(root).length, 4);
});

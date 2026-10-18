import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { readEvents } from "../src/event-log.ts";
import { fakeAgent, temporaryFolder } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const USAGE = "usage: arthur spawn <task> [--kind <name>] [--model <model>] [--thinking <level>] [--timeout <minutes>] [--budget <usd>] [--machine <name>] [--requires <labels>]";

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

test("arthur spawn returns while the agent of core.agent.command runs in the background; the job ends on its own", async () => {
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Built it." }] });
	const root = repository(CONFIG.replace('timeZone: "UTC"', `timeZone: "UTC", agent: { command: ${JSON.stringify(agent)} }`));
	const run = arthur(root, "spawn", "Build it.");
	assert.equal(run.status, 0, run.stderr);
	const id = run.stdout.trim();
	const started = join(dirname(agent), "starts.jsonl");
	for (const start = Date.now(); !existsSync(started) && Date.now() - start < 20_000; ) await sleep(20);
	const state = readFileSync(join(root, ".arthur/jobs", id, "state"), "utf8");
	assert.equal(state, "working", "the agent waits for the gate after arthur spawn returned");
	writeFileSync(gate, "");
	const ended = () => readEvents(join(root, ".arthur"), 1).find((event) => event.name === "job-ended");
	for (const start = Date.now(); ended() === undefined && Date.now() - start < 20_000; ) await sleep(20);
	assert.deepEqual(ended()?.data, { id, kind: "worker", project: "acme", state: "ended", reason: "finished" });
	assert.equal(readFileSync(join(root, ".arthur/jobs", id, "result"), "utf8"), "Built it.");
});

test("a wrapper that systemd-run did not start: arthur spawn prints the id, then the reason, and exits 1; the worktree stays", () => {
	const root = repository();
	const bin = temporaryFolder();
	writeFileSync(join(bin, "systemctl"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
	writeFileSync(join(bin, "systemd-run"), "#!/bin/sh\necho 'Failed to start transient scope unit: Access denied' >&2\nexit 1\n", { mode: 0o755 });
	const run = spawnSync(process.execPath, [CLI, "spawn", "Build it."], { cwd: root, encoding: "utf8", env: { PATH: `${bin}:${process.env.PATH}` } });
	const id = run.stdout.trim();
	assert.match(run.stdout, /^\d{4}-\d\d-\d\d-worker-[0-9a-f]{8}\n$/);
	assert.deepEqual([run.status, run.stderr.split("\n").at(-2)], [1, "failed: systemd-run: Failed to start transient scope unit: Access denied"]);
	assert.deepEqual(["state", "reason"].map((name) => readFileSync(join(root, ".arthur/jobs", id, name), "utf8")), ["ended", "failed: systemd-run: Failed to start transient scope unit: Access denied"]);
	assert.equal(git(join(dirname(root), ".arthur-worktrees", id), "branch", "--show-current"), `arthur/${id}`);
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

test("--timeout and --budget replace the kind's limits, 0 included", () => {
	const root = repository();
	const run = arthur(root, "spawn", "--kind", "review", "Review it.", "--timeout", "0.5", "--budget", "0");
	assert.equal(run.status, 0, run.stderr);
	const id = run.stdout.trim();
	assert.deepEqual(["timeout", "budget"].map((name) => readFileSync(join(root, ".arthur/jobs", id, name), "utf8")), ["0.5", "0"]);
});

test("refusals print the reason, exit 1 and leave no record, worktree or branch", () => {
	const root = repository();
	writeFileSync(join(root, "spec/features/AC0001-one/new.md"), "not committed\n");
	const head = git(root, "rev-parse", "--short=7", "HEAD");
	for (const [args, reason] of [
		[["Please refuse."], "refused by orchestration: maxAgents 3 reached"],
		[["Go.", "--kind", "audit"], "unknown kind audit; kinds: review, worker"],
		[["Ticket: spec/features/AC0001-one/new.md"], `Ticket: spec/features/AC0001-one/new.md: no such file at HEAD (${head}); commit it first`],
		[["Go.", "--project", "other"], "unknown project other; projects: acme"],
		[["Now break."], "plugin orchestration: prepare failed: no hook; the job's worktree and record were removed"],
		[["Go.", "--requires", "os=macos"], "requires: no plugin places jobs by labels (jobs.place); the machines plugin does"],
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
		[["Go.", "--project-x", "3"], "unknown flag --project-x"],
		[["Go.", "--budget"], "--budget needs a value"],
		[["Go.", "--budget", "-1"], "--budget needs a number of 0 or more, got -1"],
		[["Go.", "--timeout", "1e3"], "--timeout needs a number of 0 or more, got 1e3"],
		[["Go.", "--timeout", "Infinity"], "--timeout needs a number of 0 or more, got Infinity"],
		[["Go.", "--budget", "1", "--budget", "2"], "--budget given twice"],
		[["Go.", "--kind"], "--kind needs a value"],
		[["Go.", "--model", ""], "--model needs a value"],
		[["Go.", "--kind", "--model", "m"], "--kind needs a value"],
		[["Go.", "--model", "a", "--model", "b"], "--model given twice"],
		...["os=macos,os=linux", "arch=x64,arch=arm64", "gpu=yes", "os=", "os=mac os", "os=macos,", "tools"].map((labels) => [["Go.", "--requires", labels], `--requires needs os=<os>,arch=<arch>,tools=<tool>, each label once but tools, got ${labels}`] as const),
	] as const) {
		const run = arthur(root, "spawn", ...args);
		assert.deepEqual([run.status, run.stdout, run.stderr], [2, "", `arthur spawn: ${problem}\n${USAGE}\n`], args.join(" "));
	}
	assert.deepEqual(jobs(root), []);
});

test("--requires reaches jobs.place as labels, tools once per tool, with the machine the spawn names", () => {
	const place = 'host.provide("jobs.place", (asked) => (writeFileSync(import.meta.dirname + "/asked.json", JSON.stringify([asked.requires, asked.machine ?? null])), "local"));\n';
	const root = repository(CONFIG.replace("\thost.provide(", `\t${place}\thost.provide(`));
	const run = arthur(root, "spawn", "--kind", "review", "Go.", "--requires", "tools=xcode,os=macos,tools=docker,arch=arm64");
	assert.equal(run.status, 0, run.stderr);
	assert.deepEqual(JSON.parse(readFileSync(join(root, "asked.json"), "utf8")), [{ os: "macos", arch: "arm64", tools: ["xcode", "docker"] }, null]);
	assert.equal(arthur(root, "spawn", "--kind", "review", "Go.", "--machine", "local").status, 0);
	assert.deepEqual(JSON.parse(readFileSync(join(root, "asked.json"), "utf8")), [null, "local"], "a named machine is asked about too");
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

test("a worker's start moves its ticket to in-progress, other kinds' do not", () => {
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
	assert.equal(jobs(root).length, 3);
});

test("a worker on a ticket that cannot move to in-progress is refused before anything exists; review and done go on", () => {
	const root = repository();
	const board = join(root, "spec/build.json");
	const set = (status: string) => writeFileSync(board, readFileSync(board, "utf8").replace(/"status": ?"[a-z-]+"/, `"status":"${status}"`));
	const task = "Ticket: spec/features/AC0001-one/ticket.md. Build it.";
	const starts = "a worker starts on a ticket that is planned, in-progress, review, done";
	for (const status of ["planning", "merged", "dropped"]) {
		set(status);
		const run = arthur(root, "spawn", task);
		assert.deepEqual([run.status, run.stdout, run.stderr], [1, "", `arthur spawn: refused by core: AC0001 is ${status}, which cannot move to in-progress; ${starts}\n`], status);
	}
	mkdirSync(join(root, "spec/features/AC0002-two"));
	writeFileSync(join(root, "spec/features/AC0002-two/ticket.md"), "# AC0002\n");
	git(root, "add", "spec/features");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "second");
	const both = arthur(root, "spawn", `${task} Ticket: spec/features/AC0002-two/ticket.md`);
	assert.equal(both.stderr, `arthur spawn: refused by core: AC0001 is dropped, which cannot move to in-progress; AC0002 is not on the board; ${starts}\n`);
	assert.deepEqual([jobs(root), readEvents(join(root, ".arthur"), 1)], [[], []]);
	assert.equal(git(root, "branch", "--list"), "* main");
	assert.equal(arthur(root, "spawn", "--kind", "review", task).status, 0);
	for (const status of ["review", "done"]) {
		set(status);
		assert.equal(arthur(root, "spawn", task).status, 0, status);
		assert.equal(JSON.parse(readFileSync(board, "utf8"))[0].status, "in-progress");
	}
	assert.equal(jobs(root).length, 3);
});

test("without a project list a worker naming a ticket is refused, one naming none goes on", () => {
	const root = repository(CONFIG.replace(/\thost\.provide\("projects".*\n/, ""));
	const run = arthur(root, "spawn", "Ticket: spec/features/AC0001-one/ticket.md. Build it.");
	assert.deepEqual([run.status, run.stderr], [1, "arthur spawn: plugin core: beforeSpawn failed: no project list: the board needs each project's folder and ticket prefix, which the projects plugin provides\n"]);
	assert.deepEqual(jobs(root), []);
	assert.equal(arthur(root, "spawn", "Go.").status, 0);
	assert.equal(arthur(root, "spawn", "Go.", "--project", "other").stderr, "arthur spawn: unknown project other; the only project is acme\n");
});

test("--project starts the job from that project's HEAD, in its repository, and records its name", () => {
	const root = repository();
	const shop = join(dirname(root), "shop");
	git(dirname(root), "init", "--quiet", "--initial-branch=main", shop);
	git(shop, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "--allow-empty", "-m", "shop");
	const list = `[{ name: "acme", path: import.meta.dirname, prefix: "AC" }, { name: "shop", path: ${JSON.stringify(shop)}, prefix: "SH" }]`;
	writeFileSync(join(root, "arthur.config.ts"), CONFIG.replace(/\[\{ name: "acme".*?\}\]/, list));
	const run = arthur(root, "spawn", "Go.", "--project", "shop");
	assert.equal(run.status, 0, run.stderr);
	const id = run.stdout.trim();
	const field = (name: string) => readFileSync(join(root, ".arthur/jobs", id, name), "utf8");
	assert.deepEqual(["project", "root", "base"].map(field), ["shop", shop, git(shop, "rev-parse", "HEAD")]);
	assert.equal(git(field("worktree"), "rev-parse", "HEAD"), git(shop, "rev-parse", "HEAD"));
	assert.equal(arthur(root, "spawn", "Go.").status, 0, "the main project is the first");
	assert.deepEqual(readdirSync(join(root, ".arthur/jobs")).map((job) => readFileSync(join(root, ".arthur/jobs", job, "project"), "utf8")).sort(), ["acme", "shop"]);
	const unknown = arthur(root, "spawn", "Go.", "--project", "blog");
	assert.deepEqual([unknown.status, unknown.stderr], [1, "arthur spawn: unknown project blog; projects: acme, shop\n"]);
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { clock } from "../src/clock.ts";
import { eventBus } from "../src/events.ts";
import { followJob } from "../src/job-follow.ts";
import { jobRunner } from "../src/jobs.ts";
import { type AgentRun, fakeAgent, jobSlice, temporaryFolder, until } from "../src/testing.ts";

// `arthur jobs --follow <id>` (AR0670): docs/commands/jobs.md.

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// A repository `acme`, a home folder beside it and a runner whose agent plays `run`.
function setup(run: AgentRun) {
	const folder = temporaryFolder();
	const root = join(folder, "acme");
	mkdirSync(root);
	git(root, "init", "--quiet", "--initial-branch=main");
	writeFileSync(join(root, "README.md"), "acme\n");
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	const home = join(folder, "home");
	const time = clock("UTC", undefined, () => new Date("2026-11-09T08:00:00Z"));
	return { home, jobs: jobRunner(home, root, join(root, "env"), { timeoutMinutes: 120, budgetUsd: 2, idleMinutes: 10, offlineGraceMinutes: 30, unsandboxed: true, ...jobSlice }, fakeAgent(run), time, eventBus(home), () => []) };
}

// The follow of `query`: the lines it printed so far, and its end, `done` (resolved) or the refusal it rejected with.
function follow(home: string, query: string) {
	const lines: string[] = [];
	let end: string | undefined;
	const ended = followJob(home, query, (line) => void lines.push(line)).then(
		() => (end = "done"),
		(error: Error) => (end = error.message),
	);
	return { lines, ended, end: () => end };
}

// A record as the spawn leaves it, with its `files`.
function record(home: string, id: string, files: Readonly<Record<string, string>>): string {
	const folder = join(home, "jobs", id);
	mkdirSync(folder, { recursive: true });
	for (const [name, text] of Object.entries({ kind: "worker", project: "acme", task: "Go.", ...files })) writeFileSync(join(folder, name), text);
	return folder;
}

test("a run as it happens: the agent's text, each tool call, the state, then the rest once it goes on, and its end", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, jobs } = setup({
		steps: [
			{ message: "Reading first.\nThen the tests.", stopReason: "toolUse" },
			{ tool: "read", args: { path: "README.md" }, output: "acme" },
			{ tool: "bash", args: { command: "npm test" }, output: "ok" },
			{ waitFor: gate },
			{ message: "All tests pass." },
		],
	});
	const job = await jobs.spawn({ task: "Fix the README." });
	const log = join(home, "jobs", job.id, "log");
	await until("the tool calls in the log", () => existsSync(log) && readFileSync(log, "utf8").includes("bash npm test\n"));
	const followed = follow(home, job.id.slice(-8));
	const own = (line: string) => !line.startsWith("[arthur ");
	await until("the state after the log", () => followed.lines.includes("state: working"));
	assert.deepEqual(followed.lines.filter(own), ["> Reading first.", "> Then the tests.", "read README.md", "bash npm test", "state: working"]);
	assert.equal(followed.end(), undefined, "it follows while the job runs");
	writeFileSync(gate, "");
	await followed.ended;
	assert.deepEqual([followed.end(), followed.lines.filter(own).slice(5)], ["done", ["> All tests pass.", "state: ended (finished)"]]);
	assert.match(followed.lines.at(-2) ?? "", /^\[arthur [^\]]+\] ended: finished$/, "the log's last line comes before the state that ends the run");
});

test("a run that ends blocked on the user ends the follow with its reason", async () => {
	const { home, jobs } = setup({ steps: [{ message: "Blocked: user may I drop the old table?" }] });
	const job = await jobs.spawn({ task: "Go." });
	const followed = follow(home, job.id);
	await followed.ended;
	assert.deepEqual([followed.end(), followed.lines.at(-1)], ["done", "state: blocked (user: may I drop the old table?)"]);
	assert.ok(followed.lines.includes("> Blocked: user may I drop the old table?"));
});

test("an ended job prints its whole log and its state at once; a change of state or reason in a run is one line each; a record without a state waits", async () => {
	const home = temporaryFolder();
	record(home, "2026-11-09-worker-0000000a", { log: "read README.md\n> Done.\n", state: "ended", reason: "stopped" });
	const ended = follow(home, "0000000a");
	await ended.ended;
	assert.deepEqual([ended.end(), ended.lines], ["done", ["read README.md", "> Done.", "state: ended (stopped)"]]);
	// No state yet, then held by a plugin: still in a run; only its end ends the follow.
	const folder = record(home, "2026-11-09-worker-0000000b", {});
	const held = follow(home, "0000000b");
	await until("the first state line", () => held.lines.length === 1);
	writeFileSync(join(folder, "state"), "working");
	await until("working", () => held.lines.at(-1) === "state: working");
	for (const [name, text] of [["hold", "the deploy"], ["reason", "dependency: the deploy"], ["state", "blocked"]] as const) writeFileSync(join(folder, name), text);
	await until("held", () => held.lines.at(-1) === "state: blocked (dependency: the deploy)");
	// A reason written before its state: told once the state is written too, as a move does.
	writeFileSync(join(folder, "reason"), "dependency: the release");
	appendFileSync(join(folder, "log"), "marker\n");
	await until("the line after the reason", () => held.lines.at(-1) === "marker");
	writeFileSync(join(folder, "state"), "blocked");
	await until("its new reason", () => held.lines.at(-1) === "state: blocked (dependency: the release)");
	assert.equal(held.end(), undefined, "a held job is in its run");
	for (const [name, text] of [["hold", ""], ["reason", "finished"], ["state", "ended"]] as const) writeFileSync(join(folder, name), text);
	await held.ended;
	assert.deepEqual([held.end(), held.lines], ["done", ["state: without a state", "state: working", "state: blocked (dependency: the deploy)", "marker", "state: blocked (dependency: the release)", "state: ended (finished)"]]);
});

test("a line waits for its line break, a character split across two writes included", async () => {
	const home = temporaryFolder();
	const folder = record(home, "2026-11-09-worker-0000000c", { state: "working", log: "" });
	const followed = follow(home, "0000000c");
	const check = Buffer.from("✓");
	appendFileSync(join(folder, "log"), Buffer.concat([Buffer.from("first\nhalf"), Buffer.from("line "), check.subarray(0, 2)]));
	await until("the whole line", () => followed.lines.includes("first"));
	appendFileSync(join(folder, "log"), Buffer.concat([check.subarray(2), Buffer.from("\n")]));
	writeFileSync(join(folder, "state"), "ended");
	await followed.ended;
	assert.deepEqual(followed.lines, ["state: working", "first", "halfline ✓", "state: ended"]);
});

test("refused: an unknown id, and a record removed while it follows", async () => {
	const home = temporaryFolder();
	mkdirSync(join(home, "jobs"));
	await assert.rejects(followJob(home, "deadbeef", () => {}), { message: `deadbeef: no such job in ${join(home, "jobs")}` });
	const folder = record(home, "2026-11-09-worker-0000000d", { state: "working" });
	const followed = follow(home, "0000000d");
	await until("its first line", () => followed.lines.length === 1);
	rmSync(folder, { recursive: true });
	await followed.ended;
	assert.equal(followed.end(), "2026-11-09-worker-0000000d: its record is gone");
});

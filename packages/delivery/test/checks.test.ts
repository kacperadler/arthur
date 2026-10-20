import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import checks from "../src/checks-extension.ts";

const SUMMARY = (passed: number, failed: number) => `✔ a\nℹ tests ${passed + failed}\nℹ suites 0\nℹ pass ${passed}\nℹ fail ${failed}\nℹ duration_ms 5\n`;
const BOTH = JSON.stringify({ scripts: { check: "tsc", test: "node --test" } });

type Call = { readonly toolName: string; readonly input?: object; readonly output?: string; readonly isError?: boolean; readonly details?: object };

// The extension loaded as omp loads it into job `2026-01-01-worker-00000001` of a home folder, the worktree's package.json
// `packageJson` (none when null); `run(calls)` plays tool results as omp hands them over and answers the job's `checks`.
function load(t: TestContext, packageJson: string | null = BOTH) {
	const [home, worktree] = [temporaryFolder(), temporaryFolder()];
	if (packageJson !== null) writeFileSync(join(worktree, "package.json"), packageJson);
	const before = process.env.ARTHUR_JOB;
	process.env.ARTHUR_JOB = join(home, "jobs", "2026-01-01-worker-00000001");
	t.after(() => (before === undefined ? delete process.env.ARTHUR_JOB : (process.env.ARTHUR_JOB = before)));
	const handlers: ((event: object, ctx: { readonly cwd: string }) => unknown)[] = [];
	checks({ on: (_event, handler) => void handlers.push(handler as (typeof handlers)[number]) });
	const file = join(home, "delivery", "2026-01-01-worker-00000001", "checks");
	const run = (...calls: readonly Call[]) => {
		for (const { toolName, input = {}, output = "", isError = false, details = {} } of calls)
			for (const handler of handlers) assert.equal(handler({ type: "tool_result", toolCallId: "toolu_1", toolName, input, content: [{ type: "text", text: output }], details, isError }, { cwd: worktree }), undefined, "the result is left as it is");
		return existsSync(file) ? readFileSync(file, "utf8") : "";
	};
	return { run, file, worktree };
}

const bash = (command: string, output = "", isError = false): Call => ({ toolName: "bash", input: { command }, output, isError });

test("a check passes by its exit status, and fails on it or on a TypeScript error a pipe hides", (t) => {
	assert.equal(load(t).run(bash("npm run check", "> tsc\n")), "check pass\n");
	assert.equal(load(t).run(bash("npm run check", "Command exited with code 2", true)), "check fail\n");
	assert.equal(load(t).run(bash("npm run check | tail -5", "src/a.ts(3,1): error TS2304: Cannot find name 'x'.\n")), "check fail\n");
});

test("a test takes its counts from node --test's last summary, a piped one too, or its exit status without one; npm t and npm run test count", (t) => {
	assert.equal(load(t).run(bash("npm test", SUMMARY(5, 0))), "test pass 5/5\n");
	assert.equal(load(t).run(bash("npm test 2>&1 | tail -20", SUMMARY(4, 1))), "test fail 4/5\n", "the pipe's status says 0; the summary says fail");
	assert.equal(load(t).run(bash("npm t", `${SUMMARY(1, 1)}${SUMMARY(2, 0)}`)), "test pass 2/2\n");
	assert.equal(load(t).run(bash("npm run test", "no summary\n", true)), "test fail\n");
	assert.equal(load(t).run(bash("npm run test", "no summary\n")), "test pass\n");
});

test("commands joined by ;, && or | give one line each, in their order; any other command, or one that only mentions npm test, none", (t) => {
	assert.equal(load(t).run(bash("npm run check && npm test", SUMMARY(3, 0))), "check pass\ntest pass 3/3\n");
	assert.equal(load(t).run(bash("npm test; npm run check", SUMMARY(3, 0))), "test pass 3/3\ncheck pass\n");
	assert.equal(load(t).run(bash("npm ci | tail -1 && npm test | tail -3", SUMMARY(3, 0))), "test pass 3/3\n");
	for (const command of ["npm install", "git commit -m 'npm test'", "echo npm test", "npm run checkout", "npm testing", "grep -rn 'npm test' docs"])
		assert.equal(load(t).run(bash(command, SUMMARY(3, 0))), "", command);
	assert.equal(load(t).run({ toolName: "read", input: { path: "package.json" }, output: "npm test" }), "", "another tool");
});

test("a script the package.json does not declare, or a missing or broken package.json, gives no line", (t) => {
	assert.equal(load(t, JSON.stringify({ scripts: { test: "node --test" } })).run(bash("npm run check && npm test", SUMMARY(3, 0))), "test pass 3/3\n");
	for (const text of [null, "{ broken", "null", JSON.stringify({ scripts: { check: 1, test: ["x"] } })]) assert.equal(load(t, text).run(bash("npm run check && npm test", SUMMARY(3, 0))), "", String(text));
	const { run, worktree } = load(t);
	assert.equal(run(bash("npm test", SUMMARY(1, 0))), "test pass 1/1\n");
	rmSync(join(worktree, "package.json"));
	assert.equal(run(bash("npm test", SUMMARY(1, 0))), "test pass 1/1\n", "read at each call: the worktree's package.json, gone during the job, declares none");
});

test("two edits after a check make one stale line; an edit before any check, none; a run after it counts again", (t) => {
	const { run } = load(t);
	assert.equal(run({ toolName: "edit", input: { path: "a.ts" } }), "", "nothing to make stale");
	run(bash("npm test", SUMMARY(3, 0)));
	assert.equal(run({ toolName: "edit", input: { path: "a.ts" } }, { toolName: "write", input: { path: "b.ts" } }), "test pass 3/3\nstale\n");
	assert.equal(run(bash("npm run check")), "test pass 3/3\nstale\ncheck pass\n");
	assert.equal(run({ toolName: "write", input: { path: "c.ts" } }), "test pass 3/3\nstale\ncheck pass\nstale\n");
});

test("a call the bash tool moved to the background, and a job without a record, give no line", (t) => {
	const { run } = load(t);
	assert.equal(run({ ...bash("npm test", "Backgrounded as job 1; result will be delivered automatically."), details: { async: { state: "running", jobId: "1", type: "bash" } } }), "");
	const before = process.env.ARTHUR_JOB;
	delete process.env.ARTHUR_JOB;
	t.after(() => (process.env.ARTHUR_JOB = before));
	const handlers: unknown[] = [];
	checks({ on: (_event, handler) => void handlers.push(handler) });
	assert.deepEqual(handlers, [], "the coordinator, or omp run by hand, records nothing");
});

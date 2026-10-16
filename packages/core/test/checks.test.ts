import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkLines, declaredChecks } from "../src/checks.ts";
import { temporaryFolder } from "../src/testing.ts";

const BOTH = ["check", "test"] as const;
const SUMMARY = (passed: number, failed: number) => `✔ a\nℹ tests ${passed + failed}\nℹ suites 0\nℹ pass ${passed}\nℹ fail ${failed}\nℹ duration_ms 5\n`;

test("a check passes or fails by its exit status and the TypeScript errors it prints", () => {
	assert.deepEqual(checkLines("npm run check", "> tsc\n", false, BOTH), ["check pass"]);
	assert.deepEqual(checkLines("npm run check", "", true, BOTH), ["check fail"]);
	assert.deepEqual(checkLines("npm run check | tail -5", "src/a.ts(3,1): error TS2304: Cannot find name 'x'.\n", false, BOTH), ["check fail"]);
});

test("a test takes its counts from node --test's last summary, or its exit status without one", () => {
	assert.deepEqual(checkLines("npm test", SUMMARY(5, 0), false, BOTH), ["test pass 5/5"]);
	assert.deepEqual(checkLines("npm test 2>&1 | tail -20", SUMMARY(4, 1), false, BOTH), ["test fail 4/5"]);
	assert.deepEqual(checkLines("npm t", `${SUMMARY(1, 1)}${SUMMARY(2, 0)}`, false, BOTH), ["test pass 2/2"]);
	assert.deepEqual(checkLines("npm run test", "no summary\n", true, BOTH), ["test fail"]);
});

test("each check a command runs gives a line in its order; another command, or a script not declared, none", () => {
	assert.deepEqual(checkLines("npm run check && npm test", SUMMARY(3, 0), false, BOTH), ["check pass", "test pass 3/3"]);
	assert.deepEqual(checkLines("npm test; npm run check", SUMMARY(3, 0), false, ["check"]), ["check pass"]);
	for (const command of ["npm install", "git commit -m 'npm test'", "echo npm test", "npm run checkout", "npm testing"])
		assert.deepEqual(checkLines(command, "", false, BOTH), [], command);
});

test("the declared checks are the check and test scripts of the worktree's package.json; none without a readable one", () => {
	const worktree = temporaryFolder();
	assert.deepEqual(declaredChecks(worktree), []);
	for (const [text, declared] of [
		[JSON.stringify({ scripts: { test: "node --test", check: "tsc", lint: "x" } }), ["check", "test"]],
		[JSON.stringify({ scripts: { test: 1 } }), []],
		[JSON.stringify({ name: "no scripts" }), []],
		["null", []],
		["{ broken", []],
	] as const) {
		writeFileSync(join(worktree, "package.json"), text);
		assert.deepEqual(declaredChecks(worktree), declared, text);
	}
	mkdirSync(join(worktree, "folder", "package.json"), { recursive: true });
	assert.deepEqual(declaredChecks(join(worktree, "folder")), [], "a folder named package.json");
});

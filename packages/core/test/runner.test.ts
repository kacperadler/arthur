import assert from "node:assert/strict";
import { test } from "node:test";

// Proves `npm test` finds a package's tests and runs TypeScript as-is: the annotation below is stripped, not compiled.
test("node --test runs a package's TypeScript test", () => {
	const sum = (a: number, b: number): number => a + b;
	assert.equal(sum(2, 3), 5);
});

// This file imports no kit: the safety net comes from `npm test`'s `--import @arthur/core/testing`.
test("npm test loads the test kit's safety net into every test process", () => {
	assert.match(process.env.TMUX_TMPDIR ?? "", /arthur-test-/);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { findings } from "../src/findings.ts";
import { checkMode, checkOptions } from "../src/findings-options.ts";

// The findings plugin's options, refused by its check before any setup, and each project's piece, its mode, before its setup.

test("each mode passes as a project's piece; no option at all passes, the old mode is refused as unknown", () => {
	for (const mode of ["ticket", "grouped", "summary"]) assert.equal(checkMode(mode), undefined, mode);
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ mode: { acme: "summary" } }), [{ path: "mode", problem: 'unknown option; findings takes none: a project\'s mode is its findings.project("summary") in its project file' }]);
});

test("refused before the setup: a project's piece that is no mode, naming the project and the helper", async () => {
	for (const mode of ["tickets", "Ticket", "", "none", 1, null, { acme: "summary" }]) {
		const fake = fakeHost({ name: "findings" });
		fake.provide("projects", () => [{ name: "acme", path: temporaryFolder(), prefix: "AC", pieces: { findings: mode } }]);
		const got = mode === null ? "null" : typeof mode === "object" ? "an object" : typeof mode === "string" ? JSON.stringify(mode) : String(mode);
		await assert.rejects(fake.setup(findings()), { message: `project acme: findings.project(...): expected one of ticket, grouped, summary, got ${got}` }, String(mode));
		assert.deepEqual(fake.provided, [], "no setup ran");
	}
	const fine = fakeHost({ name: "findings" });
	fine.provide("projects", () => [{ name: "acme", path: temporaryFolder(), prefix: "AC", pieces: findings.project("summary") }]);
	await fine.setup(findings());
});

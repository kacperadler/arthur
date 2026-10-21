import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { findings } from "../src/findings.ts";
import { checkOptions } from "../src/findings-options.ts";

// The findings plugin's options, refused at load: by its check before any setup, and by its setup once the projects are there.

test("each mode passes for any project; no mode at all too", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ mode: {} }), []);
	assert.deepEqual(checkOptions({ mode: { acme: "ticket", shop: "grouped", client: "summary" } }), []);
});

test("refused: an unknown option, mode not an object, an unknown mode, naming its project", () => {
	assert.deepEqual(checkOptions({ modes: {} }), [{ path: "modes", problem: "unknown option; options: mode" }]);
	assert.deepEqual(checkOptions({ mode: "grouped" }), [{ path: "mode", problem: `expected an object of each project's mode, by the project's name, got "grouped"` }]);
	assert.deepEqual(checkOptions({ mode: ["ticket"] }), [{ path: "mode", problem: "expected an object of each project's mode, by the project's name, got a list" }]);
	for (const mode of ["tickets", "Ticket", "", "none", 1, null])
		assert.deepEqual(checkOptions({ mode: { acme: "ticket", shop: mode } }), [{ path: "mode.shop", problem: `project shop: expected one of ticket, grouped, summary, got ${mode === null ? "null" : JSON.stringify(mode)}` }], String(mode));
});

test("refused at setup: a key of mode that is no project of the list", async () => {
	const options = { mode: { acme: "summary", beta: "grouped", gamma: "ticket" } } as const;
	const fake = fakeHost({ name: "findings", options });
	fake.provide("projects", () => [{ name: "acme", path: temporaryFolder(), prefix: "AC" }]);
	await assert.rejects(fake.setup(findings(options)), { message: "mode names beta, gamma, not a project of the projects list; each key of mode is a project's name" });
	const fine = fakeHost({ name: "findings", options: { mode: { acme: "summary" } } });
	fine.provide("projects", () => [{ name: "acme", path: temporaryFolder(), prefix: "AC" }]);
	await fine.setup(findings({ mode: { acme: "summary" } }));
	assert.deepEqual(fine.provided, ["findings.onMerge", "prompt", "coordinator.context"]);
});

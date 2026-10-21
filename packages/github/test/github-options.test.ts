import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import { checkOptions } from "../src/github-options.ts";
import { readState, writeState } from "../src/github-state.ts";

// The github plugin's option check, before any setup: every refusal names its path. And its state file read back, whatever
// a hand or a crash left in it.

test("instances as the example config has them pass: one unnamed, one named, an apiUrl, poll.everySeconds, wakeOn", () => {
	const instances = [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }, { name: "acme-2", tokenEnv: "ARTHUR_GITHUB_ACME_TOKEN", apiUrl: "https://ghe.acme.example/api/v3" }];
	assert.deepEqual(checkOptions({ instances, poll: { everySeconds: 120 }, wakeOn: ["ci-finished", "pull-request-review"] }), []);
	assert.deepEqual(checkOptions({ instances, poll: { everySeconds: 1 }, wakeOn: [] }), [], "1 s, at the limit; wakeOn empty wakes on nothing");
});

test("refused: an unknown option, no instances, an instance not an object, an unknown key, a missing tokenEnv", () => {
	const one = [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }];
	assert.deepEqual(checkOptions({ instances: one, wake: ["ci-finished"] }), [{ path: "wake", problem: "unknown option; options: instances, poll, wakeOn" }]);
	for (const wakeOn of ["ci-finished", ["ci-finished", "ci-finished"], ["pull-request"], [3]])
		assert.deepEqual(checkOptions({ instances: one, wakeOn }), [{ path: "wakeOn", problem: `expected a list of distinct events among ci-finished, pull-request-review, got ${Array.isArray(wakeOn) ? "a list" : '"ci-finished"'}` }], JSON.stringify(wakeOn));
	assert.deepEqual(checkOptions({}), [{ path: "instances", problem: "expected a list of at least one instance, got nothing" }]);
	assert.deepEqual(checkOptions({ instances: [] }), [{ path: "instances", problem: "expected a list of at least one instance, got an empty list" }]);
	assert.deepEqual(checkOptions({ instances: ["ARTHUR_GITHUB_TOKEN"] }), [{ path: "instances[0]", problem: 'expected an instance { name?, tokenEnv, apiUrl? }, got "ARTHUR_GITHUB_TOKEN"' }]);
	assert.deepEqual(checkOptions({ instances: [{ tokenEnv: "X", token: "secret" }] }), [{ path: "instances[0].token", problem: "unknown key; keys: name, tokenEnv, apiUrl" }]);
	assert.deepEqual(checkOptions({ instances: [{ name: "acme" }] }), [{ path: "instances[0].tokenEnv", problem: "expected the name of an env variable, got nothing" }]);
});

test("refused: a name that is no lowercase owner, an apiUrl that is not http or https, two unnamed, one name twice", () => {
	for (const name of ["Acme", "acme_x", "-acme", "acme-", "a--b", ""])
		assert.deepEqual(checkOptions({ instances: [{ name, tokenEnv: "X" }] }), [{ path: "instances[0].name", problem: `expected a GitHub owner in lowercase: letters, digits and single dashes, got ${JSON.stringify(name)}` }], name);
	for (const apiUrl of ["api.github.com", "ftp://api.github.com", ""])
		assert.deepEqual(checkOptions({ instances: [{ tokenEnv: "X", apiUrl }] }), [{ path: "instances[0].apiUrl", problem: `expected an http or https URL, got ${JSON.stringify(apiUrl)}` }], apiUrl);
	assert.deepEqual(checkOptions({ instances: [{ tokenEnv: "X" }, { tokenEnv: "Y" }] }), [{ path: "instances[1]", problem: "instances[0] has no name either; at most one instance is unnamed" }]);
	assert.deepEqual(checkOptions({ instances: [{ name: "acme", tokenEnv: "X" }, { name: "acme", tokenEnv: "Y" }] }), [{ path: "instances[1].name", problem: "acme is the name of instances[0] too" }]);
});

test("refused: poll not an object, an unknown key in it, everySeconds below 1 or not whole", () => {
	const instances = [{ tokenEnv: "X" }];
	assert.deepEqual(checkOptions({ instances, poll: 120 }), [{ path: "poll", problem: "expected { everySeconds }, got 120" }]);
	assert.deepEqual(checkOptions({ instances, poll: { every: 120 } }), [{ path: "poll.every", problem: "unknown key; keys: everySeconds" }]);
	for (const everySeconds of [0, -1, 1.5, "120"])
		assert.deepEqual(checkOptions({ instances, poll: { everySeconds } }), [{ path: "poll.everySeconds", problem: `expected a whole number of seconds, 1 or more, got ${JSON.stringify(everySeconds)}` }], String(everySeconds));
});

test("the state: written and read back; a broken file, or entry 57's run ids, is no project polled yet, a project's wrong entry that project only", () => {
	const folder = temporaryFolder();
	assert.deepEqual(readState(folder), { runs: {}, pulls: {} }, "no file");
	const state = { runs: { shop: ["12/2", "11/1"], site: [] }, pulls: { shop: { polled: "2026-01-01T00:01:00.000Z", open: { "5": { updated: "2026-01-01T00:00:00Z", told: [80] } } }, site: { polled: "2026-01-01T00:01:00.000Z", open: {} } } };
	writeState(folder, state);
	assert.deepEqual(readState(folder), state);
	const site = { polled: "2026-01-01T00:01:00.000Z", open: { "6": { updated: "x", told: [1] } } };
	const pulls = { shop: { polled: site.polled, open: { "5": { updated: 1, told: [] } } }, site, tool: [], x: { polled: site.polled, open: { "7": null } }, y: { polled: "yesterday", open: {} }, z: { polled: site.polled }, old: { "5": { updated: "x", told: [1] } } };
	writeFileSync(join(folder, "state.json"), `${JSON.stringify({ runs: { shop: ["12/1", "13"], site: ["3/1"], tool: "4/1" }, pulls })}\n`);
	assert.deepEqual(readState(folder), { runs: { site: ["3/1"] }, pulls: { site } }, "an entry written before AR0250, without polled, is that project not polled yet");
	for (const text of ["{", "[1]", "null", "", '{"shop": [12, 13]}']) {
		writeFileSync(join(folder, "state.json"), text);
		assert.deepEqual(readState(folder), { runs: {}, pulls: {} }, text);
	}
});

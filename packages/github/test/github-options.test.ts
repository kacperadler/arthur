import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import { checkOptions } from "../src/github-options.ts";
import { readState, writeState } from "../src/github-state.ts";

// The github plugin's option check, before any setup: every refusal names its path. And its state file read back, whatever
// a hand or a crash left in it.

test("instances as the example config has them pass: one unnamed, one named, an apiUrl, poll.everySeconds", () => {
	const instances = [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }, { name: "acme-2", tokenEnv: "ARTHUR_GITHUB_ACME_TOKEN", apiUrl: "https://ghe.acme.example/api/v3" }];
	assert.deepEqual(checkOptions({ instances, poll: { everySeconds: 120 } }), []);
	assert.deepEqual(checkOptions({ instances, poll: { everySeconds: 1 } }), [], "1 s, at the limit");
});

test("refused: an unknown option, no instances, an instance not an object, an unknown key, a missing tokenEnv", () => {
	const one = [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }];
	assert.deepEqual(checkOptions({ instances: one, wakeOn: ["ci-finished"] }), [{ path: "wakeOn", problem: "unknown option; options: instances, poll" }]);
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

test("the state: written and read back; a broken file is no project polled yet, a project's wrong entry that project only", () => {
	const folder = temporaryFolder();
	assert.deepEqual(readState(folder), {}, "no file");
	writeState(folder, { shop: [12, 11], site: [] });
	assert.deepEqual(readState(folder), { shop: [12, 11], site: [] });
	writeFileSync(join(folder, "state.json"), '{"shop": [12, 1.5], "site": [3], "tool": "4"}\n');
	assert.deepEqual(readState(folder), { site: [3] });
	for (const text of ["{", "[1]", "null", ""]) {
		writeFileSync(join(folder, "state.json"), text);
		assert.deepEqual(readState(folder), {}, text);
	}
});

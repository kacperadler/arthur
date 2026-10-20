import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions } from "../src/manage-options.ts";

// The manage plugin's option check, before any setup: every refusal names its path.

test("no options, and health.everyMinutes from 1 up, pass", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ health: {} }), []);
	assert.deepEqual(checkOptions({ health: { everyMinutes: 1 } }), [], "1 min, at the limit");
	assert.deepEqual(checkOptions({ health: { everyMinutes: 30 } }), []);
});

test("refused: an unknown option, health not an object, an unknown key, everyMinutes below 1 or not whole", () => {
	assert.deepEqual(checkOptions({ audit: {} }), [{ path: "audit", problem: "unknown option; options: health" }]);
	for (const health of [30, [], null]) assert.equal(checkOptions({ health })[0]?.path, "health", String(health));
	assert.deepEqual(checkOptions({ health: 30 }), [{ path: "health", problem: "expected { everyMinutes }, got 30" }]);
	assert.deepEqual(checkOptions({ health: { every: 30 } }), [{ path: "health.every", problem: "unknown key; keys: everyMinutes" }]);
	for (const [everyMinutes, got] of [[0, "0"], [1.5, "1.5"], ["30", '"30"']] as const)
		assert.deepEqual(checkOptions({ health: { everyMinutes } }), [{ path: "health.everyMinutes", problem: `expected a whole number of minutes, 1 or more, got ${got}` }], got);
});

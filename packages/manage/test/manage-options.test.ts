import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions } from "../src/manage-options.ts";

// The manage plugin's option check, before any setup: every refusal names its path.

test("no options, health.everyMinutes from 1 up and prune.keepJobsDays from 0 up pass", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ health: {} }), []);
	assert.deepEqual(checkOptions({ health: { everyMinutes: 1 } }), [], "1 min, at the limit");
	assert.deepEqual(checkOptions({ health: { everyMinutes: 30 } }), []);
	assert.deepEqual(checkOptions({ prune: { keepJobsDays: 0 } }), [], "0 days, at the limit");
	assert.deepEqual(checkOptions({ health: { everyMinutes: 30 }, prune: { keepJobsDays: 14 } }), []);
});

test("refused: an unknown option, health not an object, an unknown key, everyMinutes below 1 or not whole", () => {
	assert.deepEqual(checkOptions({ audit: {} }), [{ path: "audit", problem: "unknown option; options: health, prune" }]);
	for (const health of [30, [], null]) assert.equal(checkOptions({ health })[0]?.path, "health", String(health));
	assert.deepEqual(checkOptions({ health: 30 }), [{ path: "health", problem: "expected { everyMinutes }, got 30" }]);
	assert.deepEqual(checkOptions({ health: { every: 30 } }), [{ path: "health.every", problem: "unknown key; keys: everyMinutes" }]);
	for (const [everyMinutes, got] of [[0, "0"], [1.5, "1.5"], ["30", '"30"']] as const)
		assert.deepEqual(checkOptions({ health: { everyMinutes } }), [{ path: "health.everyMinutes", problem: `expected a whole number of minutes, 1 or more, got ${got}` }], got);
});

test("refused: prune not an object, without keepJobsDays, an unknown key, keepJobsDays below 0 or not whole", () => {
	for (const prune of [7, [], null]) assert.deepEqual(checkOptions({ prune })[0]?.path, "prune", String(prune));
	assert.deepEqual(checkOptions({ prune: 7 }), [{ path: "prune", problem: "expected { keepJobsDays }, got 7" }]);
	assert.deepEqual(checkOptions({ prune: {} }), [{ path: "prune.keepJobsDays", problem: "expected a whole number of days, 0 or more, got nothing" }]);
	assert.deepEqual(checkOptions({ prune: { keepJobsDays: 7, days: 7 } }), [{ path: "prune.days", problem: "unknown key; keys: keepJobsDays" }]);
	for (const [keepJobsDays, got] of [[-1, "-1"], [1.5, "1.5"], ["7", '"7"']] as const)
		assert.deepEqual(checkOptions({ prune: { keepJobsDays } }), [{ path: "prune.keepJobsDays", problem: `expected a whole number of days, 0 or more, got ${got}` }], got);
});

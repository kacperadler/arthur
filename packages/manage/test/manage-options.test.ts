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
	assert.deepEqual(checkOptions({ backup: {} }), [{ path: "backup", problem: "unknown option; options: health, prune, audit, retro" }]);
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

test("audit.at alone, and with each of days, budgetUsd and model at its limits, passes", () => {
	assert.deepEqual(checkOptions({ audit: { at: "00:00" } }), []);
	assert.deepEqual(checkOptions({ audit: { at: "23:59", days: ["sun"], budgetUsd: 0, model: "anthropic/opus" } }), [], "one day, budget 0 (no limit)");
	assert.deepEqual(checkOptions({ audit: { at: "02:00", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], budgetUsd: 12.5, model: ["a/b", "c/d"] } }), []);
});

test("refused: audit not an object or without at, an unknown key, and each key's wrong value", () => {
	assert.deepEqual(checkOptions({ audit: "02:00" }), [{ path: "audit", problem: 'expected { at, days, budgetUsd, model }, got "02:00"' }]);
	assert.deepEqual(checkOptions({ audit: { days: ["mon"] } }), [{ path: "audit.at", problem: 'expected "HH:MM", 00:00 to 23:59, got nothing' }]);
	assert.deepEqual(checkOptions({ audit: { at: "02:00", focus: "x" } }), [{ path: "audit.focus", problem: "unknown key; keys: at, days, budgetUsd, model" }]);
	for (const at of ["24:00", "2:00", 200]) assert.equal(checkOptions({ audit: { at } })[0]?.path, "audit.at", String(at));
	const days = "expected a non-empty list of mon, tue, wed, thu, fri, sat, sun, each once";
	assert.deepEqual(checkOptions({ audit: { at: "02:00", days: [] } }), [{ path: "audit.days", problem: `${days}, got a list` }]);
	assert.deepEqual(checkOptions({ audit: { at: "02:00", days: ["mon", "Tue"] } }), [{ path: "audit.days", problem: `${days}, got a list` }]);
	assert.deepEqual(checkOptions({ audit: { at: "02:00", days: ["mon", "mon"] } }), [{ path: "audit.days", problem: `${days}, got a list` }]);
	assert.deepEqual(checkOptions({ audit: { at: "02:00", days: "mon" } }), [{ path: "audit.days", problem: `${days}, got "mon"` }]);
	for (const budgetUsd of [-0.01, "10", Number.POSITIVE_INFINITY])
		assert.deepEqual(checkOptions({ audit: { at: "02:00", budgetUsd } })[0]?.path, "audit.budgetUsd", String(budgetUsd));
	for (const model of ["", " ", [], ["a/b", ""], 3]) assert.deepEqual(checkOptions({ audit: { at: "02:00", model } })[0]?.path, "audit.model", JSON.stringify(model));
});

test("retro.day, retro.at and retro.budgetUsd pass at their limits; refused: retro not an object, without day or at, an unknown key, a wrong day, time or budget", () => {
	assert.deepEqual(checkOptions({ retro: { day: "mon", at: "00:00" } }), []);
	assert.deepEqual(checkOptions({ retro: { day: "sun", at: "23:59", budgetUsd: 0 } }), [], "budget 0, no limit");
	assert.deepEqual(checkOptions({ retro: "fri" }), [{ path: "retro", problem: 'expected { day, at, budgetUsd }, got "fri"' }]);
	assert.deepEqual(checkOptions({ retro: {} }), [
		{ path: "retro.day", problem: "expected one of mon, tue, wed, thu, fri, sat, sun, got nothing" },
		{ path: "retro.at", problem: 'expected "HH:MM", 00:00 to 23:59, got nothing' },
	]);
	assert.deepEqual(checkOptions({ retro: { day: "fri", at: "22:30", days: ["fri"] } }), [{ path: "retro.days", problem: "unknown key; keys: day, at, budgetUsd" }]);
	for (const day of ["Fri", "friday", ["fri"], 5]) assert.equal(checkOptions({ retro: { day, at: "22:30" } })[0]?.path, "retro.day", JSON.stringify(day));
	for (const at of ["24:00", "9:00", 2230]) assert.equal(checkOptions({ retro: { day: "fri", at } })[0]?.path, "retro.at", String(at));
	for (const budgetUsd of [-0.01, "5"]) assert.equal(checkOptions({ retro: { day: "fri", at: "22:30", budgetUsd } })[0]?.path, "retro.budgetUsd", String(budgetUsd));
});

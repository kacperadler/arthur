import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { withLock } from "../src/lock.ts";
import { temporaryFolder } from "../src/testing.ts";

test("the lock holds the holder's pid while it runs, and is gone after, also when the run throws", () => {
	const folder = temporaryFolder();
	const path = join(folder, "board.lock");
	assert.equal(withLock(path, () => readdirSync(folder).join()), "board.lock");
	assert.throws(() => withLock(path, () => assert.fail("broken")), { message: "broken" });
	assert.deepEqual(readdirSync(folder), []);
});

test("a lock held by a live process is waited for, then refused naming its pid", () => {
	const path = join(temporaryFolder(), "board.lock");
	writeFileSync(path, String(process.pid));
	const started = Date.now();
	assert.throws(() => withLock(path, () => assert.fail("ran under another holder's lock"), 200), {
		message: `${path}: held by pid ${process.pid} for over 0.2 s`,
	});
	assert.ok(Date.now() - started >= 200);
	assert.ok(existsSync(path), "the live holder's lock is kept");
});

test("a lock of a dead pid, or one that names no pid, is taken over", () => {
	const dead = spawnSync(process.execPath, ["-e", ""]).pid;
	for (const text of [String(dead), "", "not a pid"]) {
		const folder = temporaryFolder();
		const path = join(folder, "board.lock");
		writeFileSync(path, text);
		assert.equal(withLock(path, () => "ran", 200), "ran", `a lock holding ${JSON.stringify(text)}`);
		assert.deepEqual(readdirSync(folder), []);
	}
});

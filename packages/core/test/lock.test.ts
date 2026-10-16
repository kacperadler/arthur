import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { takeLock, withLock } from "../src/lock.ts";
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

test("a lock of a dead pid, one that names no pid, or one an earlier boot wrote is taken over", () => {
	const dead = spawnSync(process.execPath, ["-e", ""]).pid;
	// The test's own pid is alive: only the boot it names makes the lock stale, on a system that names its boot.
	const earlierBoot = existsSync("/proc/sys/kernel/random/boot_id") ? [`${process.pid} 00000000-0000-0000-0000-000000000000`] : [];
	for (const text of [String(dead), "", "not a pid", ...earlierBoot]) {
		const folder = temporaryFolder();
		const path = join(folder, "board.lock");
		writeFileSync(path, text);
		assert.equal(withLock(path, () => "ran", 200), "ran", `a lock holding ${JSON.stringify(text)}`);
		assert.deepEqual(readdirSync(folder), []);
	}
});

test("takeLock refuses while its holder lives, naming it, and release removes only the lock it took", () => {
	const folder = temporaryFolder();
	const path = join(folder, "run.pid");
	const first = takeLock(path);
	assert.ok("release" in first);
	assert.deepEqual(takeLock(path), { heldBy: process.pid });
	assert.deepEqual(readdirSync(folder), ["run.pid"], "a refused take leaves nothing behind");
	first.release();
	assert.deepEqual(readdirSync(folder), []);
	const second = takeLock(path);
	assert.ok("release" in second);
	// Removed by hand, then taken by another process: not this one's to remove.
	rmSync(path);
	writeFileSync(path, "1");
	second.release();
	assert.equal(readFileSync(path, "utf8"), "1");
});

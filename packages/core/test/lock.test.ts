import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { queueLock, takeLock, withLock } from "../src/lock.ts";
import { temporaryFolder } from "../src/testing.ts";

// A lock file as a holder that crashed in this boot left it: its pid, then the boot where the system names one.
const BOOT_ID = "/proc/sys/kernel/random/boot_id";
const crashed = (pid: number | undefined) => (existsSync(BOOT_ID) ? `${pid} ${readFileSync(BOOT_ID, "utf8").trim()}` : String(pid));

test("the lock holds the holder's pid while it runs, and is gone after, also when the run throws", () => {
	const folder = temporaryFolder();
	const path = join(folder, "board.lock");
	assert.equal(withLock(path, () => readdirSync(folder).join()), "board.lock");
	assert.throws(() => withLock(path, () => assert.fail("broken")), { message: "broken" });
	assert.deepEqual(readdirSync(folder), []);
});

test("a lock held by a live process is waited for, then refused naming its pid", () => {
	// The test runner that started this file is alive while it runs.
	const path = join(temporaryFolder(), "board.lock");
	writeFileSync(path, crashed(process.ppid));
	const started = Date.now();
	assert.throws(() => withLock(path, () => assert.fail("ran under another holder's lock"), 200), {
		message: `${path}: held by pid ${process.ppid} for over 0.2 s`,
	});
	assert.ok(Date.now() - started >= 200);
	assert.ok(existsSync(path), "the live holder's lock is kept");
	assert.deepEqual(takeLock(path), { heldBy: process.ppid });
});

test("withLock inside withLock of the same lock waits for this process's own holder, then refuses naming this pid", () => {
	const path = join(temporaryFolder(), "board.lock");
	const inner = () => withLock(path, () => assert.fail("ran under this process's own held lock"), 50);
	assert.throws(() => withLock(path, inner), { message: `${path}: held by pid ${process.pid} for over 0.05 s` });
});

test("a lock naming this process's pid that an earlier process of the same pid left is taken over, also behind its guard", async () => {
	// As `docker restart` leaves them: the same pid in the same boot. Last, the file a crash between linking and unlinking
	// left: the lock and the earlier process's own file `<path>.<pid>` are one, which this process's own file overwrites.
	for (const extra of ["", "run.pid.takeover", `run.pid.${process.pid}`]) {
		const folder = temporaryFolder();
		const path = join(folder, "run.pid");
		const seed = () => {
			writeFileSync(path, crashed(process.pid));
			if (extra.endsWith(".takeover")) writeFileSync(join(folder, extra), crashed(process.pid));
			else if (extra !== "") linkSync(path, join(folder, extra));
		};
		seed();
		const lock = takeLock(path);
		assert.ok("release" in lock, `takeLock past run.pid ${extra}`);
		assert.deepEqual(takeLock(path), { heldBy: process.pid }, "the lock it took stays held");
		assert.equal(await queueLock(path, 50).catch((error: Error) => error.message), `${path}: held by pid ${process.pid} for over 0.05 s`);
		lock.release();
		assert.deepEqual(readdirSync(folder), []);
		seed();
		assert.equal(withLock(path, () => readdirSync(folder).join(), 200), "run.pid", `withLock past run.pid ${extra}`);
		assert.deepEqual(readdirSync(folder), []);
	}
});

test("a lock this process released counts as a dead holder's, also a file of its inode left naming this pid", () => {
	// The released lock's file stays linked as `kept`, then comes back at the lock's path, as an earlier process's would.
	const folder = temporaryFolder();
	const path = join(folder, "board.lock");
	const kept = join(folder, "kept");
	withLock(path, () => linkSync(path, kept));
	renameSync(kept, path);
	assert.equal(withLock(path, () => "ran", 200), "ran", "withLock");
	const lock = takeLock(path);
	assert.ok("release" in lock);
	linkSync(path, kept);
	lock.release();
	renameSync(kept, path);
	assert.ok("release" in takeLock(path), "takeLock");
});

test("a lock of a dead pid, one that names no pid, or one an earlier boot wrote is taken over", () => {
	const dead = spawnSync(process.execPath, ["-e", ""]).pid;
	// A live pid other than this one: only the boot it names makes the lock stale, on a system that names its boot.
	const earlierBoot = existsSync(BOOT_ID) ? [`${process.ppid} 00000000-0000-0000-0000-000000000000`] : [];
	for (const text of [String(dead), crashed(dead), "", "not a pid", ...earlierBoot]) {
		const folder = temporaryFolder();
		const path = join(folder, "board.lock");
		writeFileSync(path, text);
		assert.equal(withLock(path, () => "ran", 200), "ran", `a lock holding ${JSON.stringify(text)}`);
		assert.deepEqual(readdirSync(folder), []);
	}
});

test("a folder at the lock's path, as `arthur continue` left its `continuing` before it named its pid, is taken over", () => {
	const folder = temporaryFolder();
	const path = join(folder, "continuing");
	mkdirSync(path);
	const lock = takeLock(path);
	assert.ok("release" in lock, "taken");
	assert.equal(readFileSync(path, "utf8").split(" ")[0], String(process.pid));
	lock.release();
	assert.deepEqual(readdirSync(folder), []);
});

test("queueLock waits its turn behind a holder in this same process; each release removes the lock once; a holder past the wait is named", async () => {
	const folder = temporaryFolder();
	const path = join(folder, "spawn.lock");
	const first = await queueLock(path);
	let taken = false;
	const second = queueLock(path).then((release) => {
		taken = true;
		return release;
	});
	await setImmediate();
	assert.equal(taken, false, "the second waits while the first holds it");
	first();
	const release = await second;
	// The first's second call comes after the second took the lock, whatever inode it got: the lock stays.
	first();
	assert.deepEqual(readdirSync(folder), ["spawn.lock"]);
	release();
	assert.deepEqual(readdirSync(folder), []);
	const held = takeLock(path);
	// The wait is what is tested: 50 ms of the real clock.
	await assert.rejects(queueLock(path, 50), { message: `${path}: held by pid ${process.pid} for over 0.05 s` });
	if ("release" in held) held.release();
	assert.deepEqual(readdirSync(folder), []);
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
	// Removed by hand, then taken again by this process: the new lock is not the old one's to remove. The old one's file stays
	// linked as `kept`, so the new one cannot get its inode.
	rmSync(path);
	const third = takeLock(path);
	assert.ok("release" in third);
	linkSync(path, join(folder, "kept"));
	rmSync(path);
	const fourth = takeLock(path);
	assert.ok("release" in fourth);
	third.release();
	assert.deepEqual(readdirSync(folder).sort(), ["kept", "run.pid"]);
	fourth.release();
	assert.deepEqual(readdirSync(folder), ["kept"]);
});

test("a takeover guard left by a crashed taker is cleared, and the dead holder's lock is taken over", () => {
	const dead = spawnSync(process.execPath, ["-e", ""]).pid;
	const folder = temporaryFolder();
	const path = join(folder, "board.lock");
	writeFileSync(path, crashed(dead));
	writeFileSync(`${path}.takeover`, crashed(dead));
	assert.equal(withLock(path, () => readdirSync(folder).join(), 200), "board.lock");
	assert.deepEqual(readdirSync(folder), []);
});

test("processes racing for a dead holder's lock hold it one at a time, and all finish", async () => {
	await race(["board.lock"], 100);
});

test("processes racing for a dead holder's lock past a crashed taker's guard hold it one at a time, and all finish", async () => {
	await race(["board.lock", "board.lock.takeover"], 50);
});

// Before each round the files are written with a dead pid; then 8 processes take `board.lock` at once, each holding it
// 1 ms. The moments each held it, on the machine's monotonic clock that all processes share, must never overlap.
async function race(seeded: readonly string[], rounds: number): Promise<void> {
	const dead = spawnSync(process.execPath, ["-e", ""]).pid;
	const folder = temporaryFolder();
	const code = `const { withLock } = await import(${JSON.stringify(import.meta.resolve("../src/lock.ts"))});
		const sleep = new Int32Array(new SharedArrayBuffer(4));
		process.on("message", () => {
			const held = withLock(${JSON.stringify(join(folder, "board.lock"))}, () => {
				const from = process.hrtime.bigint();
				Atomics.wait(sleep, 0, 0, 1);
				return [String(from), String(process.hrtime.bigint())];
			});
			process.send(held);
		});
		process.send("ready");`;
	const children = Array.from({ length: 8 }, () =>
		spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: ["ignore", "inherit", "inherit", "ipc"] }),
	);
	const held: [bigint, bigint][] = [];
	try {
		await Promise.all(children.map(answer));
		for (let round = 0; round < rounds; round++) {
			for (const name of seeded) writeFileSync(join(folder, name), crashed(dead));
			const answers = children.map(answer);
			for (const child of children) child.send("go");
			for (const [from, to] of (await Promise.all(answers)) as [string, string][]) held.push([BigInt(from), BigInt(to)]);
			assert.deepEqual(readdirSync(folder), [], `round ${round} leaves no file behind`);
		}
	} finally {
		for (const child of children) child.kill();
	}
	assert.equal(held.length, children.length * rounds);
	held.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	let end = -1n;
	for (const [from, to] of held) {
		assert.ok(end < from, "two takers held the lock at once");
		end = to;
	}
}

// The child's next message; a child that exits first (a throw in the lock) fails the round.
function answer(child: ChildProcess): Promise<unknown> {
	const { promise, resolve, reject } = Promise.withResolvers<unknown>();
	const exited = (code: number | null) => reject(new Error(`a taker exited with ${code}`));
	child.once("exit", exited);
	child.once("message", (message) => {
		child.off("exit", exited);
		resolve(message);
	});
	return promise;
}

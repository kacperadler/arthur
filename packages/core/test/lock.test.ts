import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
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

test("a takeover guard left by a crashed taker is cleared, and the dead holder's lock is taken over", () => {
	const dead = spawnSync(process.execPath, ["-e", ""]).pid;
	const folder = temporaryFolder();
	const path = join(folder, "board.lock");
	writeFileSync(path, String(dead));
	writeFileSync(`${path}.takeover`, String(dead));
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
			for (const name of seeded) writeFileSync(join(folder, name), String(dead));
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

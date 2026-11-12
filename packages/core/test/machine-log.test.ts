import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { secretNames } from "../src/secret-names.ts";
import { fakeAgent, temporaryFolder, until } from "../src/testing.ts";
import { CLI, endedThere, events, read, setup, starts } from "./fake-machine.ts";

// Jobs on another machine (fake-machine.ts): the sweep's copy of a job's log from there.

test("a sweep's copy of the log a job on another machine appended since the last one names each env value", async () => {
	const gate = join(temporaryFolder(), "go");
	const agent = fakeAgent({ steps: [{ stderr: "first line" }, { waitFor: gate }, { stderr: "401 for s3cret-t0ken-123" }, { message: "Done." }] });
	const { home, there, jobs } = setup({ agent, hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	await until("the first line there", () => existsSync(join(there, "jobs", job.id, "log")) && read(there, job.id, "log").includes("first line\n"));
	await jobs.sweep();
	assert.match(read(home, job.id, "log"), /first line\n/);
	writeFileSync(gate, "");
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "ended");
	await jobs.sweep();
	assert.match(read(home, job.id, "log"), /first line\n[\s\S]*401 for ARTHUR_TEST_TOKEN\n/);
	assert.doesNotMatch(read(home, job.id, "log"), /s3cret-t0ken-123/);
});

test("a copy brings only the log's new bytes, appended here; arthur remote-job records sends the log from the byte asked", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await jobs.sweep();
	const before = read(there, job.id, "log");
	assert.equal(read(home, job.id, "log"), before);
	appendFileSync(join(there, "jobs", job.id, "log"), "one more line ✓\n");
	// A lock file listed but gone by its stat, as one another copy or the wrapper there holds a moment: a link to nothing.
	symlinkSync(join(there, "gone"), join(there, "jobs", job.id, "state.lock.99999999"));
	// Two copies at once, as a stop's beside the sweep's: the new bytes are appended once.
	await Promise.all([jobs.sweep(), jobs.sweep()]);
	assert.equal(read(home, job.id, "log"), `${before}one more line ✓\n`);
	const records = (asked: string) => {
		const run = spawnSync(process.execPath, [CLI, "remote-job", "records", there, `${job.id}=${asked}`], { cwd: there, encoding: "utf8" });
		return (JSON.parse(run.stdout) as Record<string, { files: Record<string, string>; logFrom: number; logSize: number; logTo: number }>)[job.id];
	};
	const size = Buffer.byteLength(`${before}one more line ✓\n`);
	assert.deepEqual(records(`0:${Buffer.byteLength(before)}`), { ...records("0:0"), logFrom: Buffer.byteLength(before), files: { ...records("0:0")?.files, log: "one more line ✓\n" } });
	assert.deepEqual([records("0:0")?.logFrom, records("0:0")?.logSize, records("0:0")?.logTo, records(`0:${size + 1}`)?.logFrom], [0, size, size, 0], "a log shorter than asked comes whole");
	assert.deepEqual([records(`0:${size}`)?.logFrom, records(`0:${size}`)?.files.log], [size, ""], "caught up exactly: nothing new, not the whole log");
	writeFileSync(gate, "");
	await endedThere(there, job.id);
});

test("a log grown by more than 1 MiB arrives whole over several copies, each cut at a character, and the job ends here only once all of it did", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await jobs.sweep();
	// 3 bytes a character: a cut 256 KiB on from a character's start falls inside one.
	appendFileSync(join(there, "jobs", job.id, "log"), `${"✓".repeat(400_000)}\n`);
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	const whole = read(there, job.id, "log");
	let copies = 0;
	for (; read(home, job.id, "state") !== "ended" && copies < 10; copies++) {
		await jobs.sweep();
		const here = read(home, job.id, "log");
		assert.ok(whole.startsWith(here), `copy ${copies + 1}: the log here is the start of the one there`);
		if (here !== whole) assert.equal(read(home, job.id, "state"), "working", `copy ${copies + 1}: the state waits for the rest of the log`);
	}
	assert.equal(read(home, job.id, "log"), whole, "every byte arrived");
	assert.deepEqual([copies, read(home, job.id, "reason"), events(home, "job-ended").length], [5, "finished", 1]);
	// Bytes none of which starts a character (a binary log): the cut moves back 3 bytes at most, so each copy still moves on.
	writeFileSync(join(there, "jobs", job.id, "log"), Buffer.alloc(300_000, 0x80));
	const run = spawnSync(process.execPath, [CLI, "remote-job", "records", there, `${job.id}=0:0`], { cwd: there, encoding: "utf8" });
	assert.equal((JSON.parse(run.stdout) as Record<string, { logTo: number }>)[job.id]?.logTo, 256 * 1024 - 3);
});

test("a line a job there is still writing waits for the next copy, asked from the same time, so a value it splits arrives only as its name", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }), hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await jobs.sweep();
	const [folder, before] = [join(there, "jobs", job.id), read(home, job.id, "log")];
	appendFileSync(join(folder, "log"), "done\n401 for ✓ s3cret-t0");
	// The log older than another file there: a copy that asked from the newest time would not send it again.
	const since = new Date(Number(read(home, job.id, "synced").split(":")[0]) + 1);
	utimesSync(join(folder, "log"), since, since);
	writeFileSync(join(folder, "task"), "Go.");
	for (const copy of [1, 2]) {
		await jobs.sweep();
		assert.equal(read(home, job.id, "log"), `${before}done\n`, `copy ${copy}: the unfinished line waits`);
	}
	// Caught up to the line's start: the copy, though it reaches the log's end, holds no line break and brings nothing.
	appendFileSync(join(folder, "log"), "ken");
	await jobs.sweep();
	assert.equal(read(home, job.id, "log"), `${before}done\n`);
	appendFileSync(join(folder, "log"), "-123\n");
	await jobs.sweep();
	assert.equal(read(home, job.id, "log"), `${before}done\n401 for ✓ ARTHUR_TEST_TOKEN\n`);
	writeFileSync(gate, "");
});

test("a copy that brings the log from its first byte, the first one or after the log there got shorter, holds back its unfinished line too", async () => {
	const gate = join(temporaryFolder(), "go"), agent = fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] });
	const { home, there, jobs } = setup({ agent, hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	const log = join(there, "jobs", job.id, "log");
	// The wrapper's notes come before the agent's start; the agent then waits, writing nothing.
	await until("the agent started there", () => starts(agent).length === 1);
	const started = readFileSync(log, "utf8");
	appendFileSync(log, "401 for s3cret-t0");
	await jobs.sweep();
	assert.equal(read(home, job.id, "log"), started, "the first copy");
	appendFileSync(log, "ken-123\n");
	await jobs.sweep();
	assert.equal(read(home, job.id, "log"), `${started}401 for ARTHUR_TEST_TOKEN\n`);
	writeFileSync(log, "rewritten\n401 for s3cret-t0");
	await jobs.sweep();
	assert.equal(read(home, job.id, "log"), "rewritten\n", "a log shorter than asked");
	appendFileSync(log, "ken-123\n");
	await jobs.sweep();
	assert.equal(read(home, job.id, "log"), "rewritten\n401 for ARTHUR_TEST_TOKEN\n");
	writeFileSync(gate, "");
});

test("a value the 256 KiB cut of a copy splits, or a last line without a line break, arrives only as its name, and the job ends here once all of it did", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }), hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await jobs.sweep();
	const log = join(there, "jobs", job.id, "log");
	// The cut, 256 KiB on from the byte the next copy asks from, falls inside the value, after "s3cret-t".
	appendFileSync(log, `${"x".repeat(256 * 1024 - 17)}\n401 for s3cret-t0ken-123\n`);
	writeFileSync(gate, "");
	await endedThere(there, job.id);
	appendFileSync(log, "a last line without a line break: s3cret-t0ken-123");
	let copies = 0;
	for (; read(home, job.id, "state") !== "ended" && copies < 5; copies++) {
		await jobs.sweep();
		assert.doesNotMatch(read(home, job.id, "log"), /s3cret/, `copy ${copies + 1}`);
	}
	assert.equal(read(home, job.id, "log"), read(there, job.id, "log").replaceAll("s3cret-t0ken-123", "ARTHUR_TEST_TOKEN"));
	assert.deepEqual([copies, events(home, "job-ended").length], [2, 1]);
});

test("a copy of many jobs whose logs grew past 256 KiB brings 512 KiB of log at most, so a link carrying 1 MiB in 20 s copies it and no job is held offline", async (t) => {
	const gate = join(temporaryFolder(), "go");
	t.after(() => writeFileSync(gate, ""));
	const { home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const ids: string[] = [];
	for (let n = 0; n < 5; n++) ids.push((await jobs.spawn({ task: "Go.", machine: "gpu" })).id);
	await jobs.sweep();
	const synced = () => ids.map((id) => Number(read(home, id, "synced").split(":")[1]));
	const before = synced();
	for (const id of ids) appendFileSync(join(there, "jobs", id, "log"), `${"x".repeat(1023)}\n`.repeat(300));
	// From here the link carries 1 MiB within the copy's 20 s: a longer answer of `records` there does not arrive before `gate` exists, or 30 s on.
	const [answer, sizes] = [join(machine, "answer"), join(machine, "sizes")];
	const slow = `n=0; while [ ! -e '${gate}' ] && [ $n -lt 300 ]; do sleep 0.1; n=$((n + 1)); done; exit 0`;
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\nif [ "$2" = records ]; then\n'${process.execPath}' '${CLI}' "$@" > '${answer}' || exit 1\nwc -c < '${answer}' >> '${sizes}'\n[ "$(wc -c < '${answer}')" -gt 1048576 ] && { ${slow}; }\nexec cat '${answer}'\nfi\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	await jobs.sweep();
	const moved = synced().map((at, index) => at - (before[index] ?? 0));
	assert.deepEqual(ids.map((id) => [read(home, id, "state"), existsSync(join(home, "jobs", id, "offline"))]), ids.map(() => ["working", false]), "no job held as offline");
	assert.ok(moved.every((bytes) => bytes > 0) && moved.reduce((sum, bytes) => sum + bytes) <= 512 * 1024, `every job moved on, 512 KiB in all at most: ${moved}`);
	assert.ok(Number(readFileSync(sizes, "utf8")) < 1048576, "one answer, within what the link carries");
	for (let copies = 0; copies < 3; copies++) await jobs.sweep();
	assert.deepEqual(ids.map((id) => read(home, id, "log") === read(there, id, "log")), ids.map(() => true), "the rest came in the next copies");
	// A job asked first that has few bytes to send leaves its share to the jobs after it.
	const [near, far, other] = ids as [string, string, string];
	const size = statSync(join(there, "jobs", near, "log")).size;
	const run = spawnSync(process.execPath, [CLI, "remote-job", "records", there, `${near}=0:${size - 10}`, `${far}=0:0`, `${other}=0:0`], { cwd: there, encoding: "utf8" });
	const copies = JSON.parse(run.stdout) as Record<string, { logFrom: number; logTo: number }>;
	assert.deepEqual([near, far, other].map((id) => (copies[id]?.logTo ?? 0) - (copies[id]?.logFrom ?? 0)), [10, 262139, 262139]);
});

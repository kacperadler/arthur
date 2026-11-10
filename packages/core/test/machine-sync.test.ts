import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { watch } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { secretNames } from "../src/secret-names.ts";
import { fakeAgent, temporaryFolder, until } from "../src/testing.ts";
import { byHand, CLI, calls, commit, endedThere, events, git, read, setup } from "./fake-machine.ts";

// Jobs on another machine (fake-machine.ts): the sweep's copy of a job's record from there, and its limits.

test("the sweep's copy of a job on another machine names each env value in its log, final message and reason here", async () => {
	const agent = fakeAgent({ steps: [{ stderr: "401 for s3cret-t0ken-123" }, { message: "Blocked: user is s3cret-t0ken-123 still valid?" }] });
	const { home, there, jobs } = setup({ agent, hide: secretNames({ ARTHUR_TEST_TOKEN: "s3cret-t0ken-123" }) });
	jobs.prepare("test", () => ({ ARTHUR_INSTALL: "echo installed with s3cret-t0ken-123" }));
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	assert.equal(job.failed, undefined);
	await until("the job's end there", () => existsSync(join(there, "jobs", job.id, "state")) && read(there, job.id, "state") === "blocked");
	assert.match(read(there, job.id, "log"), /installed with s3cret-t0ken-123\n/, "the wrapper there names nothing: no env file there");
	await jobs.sweep();
	assert.deepEqual(["state", "reason", "result"].map((name) => read(home, job.id, name)), ["blocked", "user: is ARTHUR_TEST_TOKEN still valid?", "Blocked: user is ARTHUR_TEST_TOKEN still valid?"]);
	assert.match(read(home, job.id, "log"), /installed with ARTHUR_TEST_TOKEN\n[\s\S]*401 for ARTHUR_TEST_TOKEN\n/);
	const files = readdirSync(home, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
	for (const file of files) assert.ok(!readFileSync(file, "utf8").includes("s3cret-t0ken-123"), file);
});

test("a copy that does not answer within 20 s counts as the machine unreachable, its jobs held, and the process answers meanwhile", async (t) => {
	const gate = join(temporaryFolder(), "go");
	// Ends the fake `records` there and the agent, also when an assertion fails.
	t.after(() => writeFileSync(gate, ""));
	const { home, machine, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	// From here `arthur remote-job records` there notes it began, then does not end before `gate` exists, or 30 s on, in case the
	// kit removed the gate's folder first; every other step is this core's.
	const folder = temporaryFolder();
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$2" = records ] && touch '${join(folder, "copying")}' && n=0 && while [ ! -e '${gate}' ] && [ $n -lt 300 ]; do sleep 0.1; n=$((n + 1)); done && exit 0\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	// Fake time: 20 s need not pass for real. The test's own watch, answered while the copy waits, shows the event loop free.
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const began = watch(folder);
	let done = false;
	const swept = jobs.sweep().finally(() => (done = true));
	for await (const { filename } of began) if (filename === "copying") break;
	t.mock.timers.tick(19_999);
	await nextTurn();
	assert.equal(done, false, "still copying 1 ms before its limit");
	t.mock.timers.tick(1);
	await swept;
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", "dependency: machine gpu unreachable since 2026-10-16T12:00:00.000Z"]);
});

test("two sweeps whose fetches of an ended job's branch overlap end it here once, with one job-ended", async (t) => {
	const gates = temporaryFolder();
	t.after(() => ["go1", "go2"].forEach((name) => writeFileSync(join(gates, name), "")));
	const { home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await endedThere(there, job.id);
	// The n-th `git-upload-pack` there waits for `go<n>`, or 30 s.
	const fake = `#!/bin/sh\ni=1; while ! mkdir '${gates}/'$i 2>/dev/null; do i=$((i + 1)); done\nn=0; while [ ! -e '${gates}/go'$i ] && [ $n -lt 300 ]; do sleep 0.1; n=$((n + 1)); done\nexec git upload-pack "$@"\n`;
	writeFileSync(join(machine, "bin/git-upload-pack"), fake, { mode: 0o755 });
	const first = jobs.sweep();
	await until("the first fetch", () => existsSync(join(gates, "1")));
	const second = jobs.sweep();
	await until("the second fetch", () => existsSync(join(gates, "2")));
	writeFileSync(join(gates, "go1"), "");
	await first;
	writeFileSync(join(gates, "go2"), "");
	await second;
	assert.deepEqual([read(home, job.id, "state"), events(home, "job-ended").filter((event) => event.id === job.id).length], ["ended", 1]);
});

test("a copy that answers more than 64 MiB is cut here and counts as the machine unreachable, its jobs held, the process alive", async (t) => {
	const gate = join(temporaryFolder(), "go");
	t.after(() => writeFileSync(gate, ""));
	const { home, machine, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	// From here `arthur remote-job records` there answers 100 MiB, past what `records` itself would send.
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$2" = records ] && exec head -c 104857600 /dev/zero\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	await jobs.sweep();
	assert.deepEqual([read(home, job.id, "state"), read(home, job.id, "reason")], ["blocked", "dependency: machine gpu unreachable since 2026-10-16T12:00:00.000Z"]);
});

test("a copy refuses a record file whose name is not a plain record key, naming it, and writes nothing of that answer", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const [job, other] = [await jobs.spawn({ task: "Go.", machine: "gpu" }), await jobs.spawn({ task: "Go.", machine: "gpu" })];
	await jobs.sweep();
	// From here `arthur remote-job records` there answers by hand what `answer` holds; every other step is this core's.
	const answer = join(machine, "answer");
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$2" = records ] && exec cat '${answer}'\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	const copy = (files: Record<string, string>) => writeFileSync(answer, JSON.stringify({ [job.id]: { state: "working", reason: "", since: "2026-10-16T12:00:00.000Z", at: 1, logFrom: 0, logSize: 0, logTo: 0, files } }));
	writeFileSync(join(home, "outside"), "mine\n");
	const files = (folder: string) => readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => `${join(entry.parentPath, entry.name)}: ${readFileSync(join(entry.parentPath, entry.name), "utf8")}`).sort();
	const before = files(home);
	for (const key of [`sub/../../${other.id}/branch`, "../../outside", "state.lock"]) {
		copy({ cost: "9.0000", [key]: "theirs\n" });
		await assert.rejects(jobs.sweep(), { message: `machine gpu: job ${job.id}: sent a record file ${JSON.stringify(key)}; expected a name of lowercase letters, digits and dashes` });
		assert.deepEqual(files(home), before, `${key}: nothing of the answer is written, here or elsewhere`);
	}
	copy({ cost: "9.0000" });
	await jobs.sweep();
	assert.equal(read(home, job.id, "cost"), "9.0000", "a plain key is still written");
	writeFileSync(gate, "");
});

// AR0348: one job's answer that is not of the shape of `records` is refused, nothing of it written, and the machine's other job still moves.
test("a copy refuses a job's answer of the wrong shape, naming the job, writes nothing of it, and still copies the machine's other job", async () => {
	const gate = join(temporaryFolder(), "go");
	const { home, machine, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const [first, second] = [(await jobs.spawn({ task: "Go.", machine: "gpu" })).id, (await jobs.spawn({ task: "Go.", machine: "gpu" })).id];
	await jobs.sweep();
	const answer = join(machine, "answer");
	writeFileSync(join(machine, "bin/arthur"), `#!/bin/sh\n[ "$2" = records ] && exec cat '${answer}'\nexec '${process.execPath}' '${CLI}' "$@"\n`, { mode: 0o755 });
	const copy = (files: Record<string, unknown>) => ({ state: "working", reason: "", since: "2026-10-16T12:00:00.000Z", at: 1, logFrom: 0, logSize: 0, logTo: 0, files });
	const record = (id: string) => readdirSync(join(home, "jobs", id)).map((name) => `${name}: ${read(home, id, name)}`);
	const rows: readonly (readonly [Record<string, unknown> | string | null, string])[] = [
		[{ since: "yesterday" }, `sent since "yesterday"; expected a date`],
		[{ since: 5 }, "sent since 5; expected a date"],
		[{ state: "done" }, `sent the state "done"; expected one of blocked, working, idle, ended`],
		[{ state: "ended", reason: 7 }, "sent the reason 7; expected a text"],
		[{ at: "1" }, `sent at "1"; expected a finite number`],
		[{ logFrom: null }, "sent logFrom null; expected a finite number"],
		[{ logSize: undefined }, "sent logSize undefined; expected a finite number"],
		[{ logTo: "0" }, `sent logTo "0"; expected a finite number`],
		[{ files: null }, "sent the files null; expected an object of texts"],
		[{ files: "cost" }, `sent the files "cost"; expected an object of texts`],
		[{ files: { cost: 9 } }, "sent the record file cost as 9; expected a text"],
		[null, "sent null as its record; expected an object"],
		["working", `sent "working" as its record; expected an object`],
	];
	for (const [index, [bad, why]] of rows.entries())
		for (const [badId, goodId] of [[first, second], [second, first]] as const) {
			const before = record(badId);
			const sent = typeof bad === "object" && bad !== null ? { ...copy({ cost: "9.0000" }), ...bad } : bad;
			writeFileSync(answer, JSON.stringify({ [badId]: sent, [goodId]: copy({ cost: `${index}.5000` }) }));
			await assert.rejects(jobs.sweep(), { message: `machine gpu: job ${badId}: ${why}` });
			assert.deepEqual(record(badId), before, `${why}: nothing of the job's answer is written, its state unchanged`);
			assert.equal(read(home, goodId, "cost"), `${index}.5000`, `${why}: the machine's other job is still copied`);
		}
	// Both jobs refused: each named on its own line, the newest first, as a sweep copies them.
	writeFileSync(answer, JSON.stringify({ [first]: copy({ cost: 1 }), [second]: { ...copy({}), state: "gone" } }));
	await assert.rejects(jobs.sweep(), { message: [`machine gpu: job ${second}: sent the state "gone"; expected one of blocked, working, idle, ended`, `machine gpu: job ${first}: sent the record file cost as 1; expected a text`].join("\n") });
	assert.deepEqual([first, second].map((id) => read(home, id, "state")), ["working", "working"]);
	writeFileSync(gate, "");
});

test("a copy writes only the run's files: a branch, project, task and kind sent keep the record's, and the end fetches arthur/<id> only", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const job = await jobs.spawn({ task: "Go.", machine: "gpu" });
	await jobs.sweep();
	// There, the job's branch and a branch `side` hold a commit; here, `side` is free, at `main`.
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	commit(worktree, "the change");
	const tip = git(worktree, "rev-parse", "HEAD");
	git(worktree, "branch", "side", tip);
	git(root, "branch", "side");
	const refs = () => git(root, "for-each-ref", "--format=%(refname) %(objectname)");
	const before = refs();
	const kept = ["branch", "project", "task", "kind", "root", "worktree", "base", "prompt", "timeout", "idle-minutes", "machine"];
	const spawned = kept.map((name) => read(home, job.id, name));
	const sent = Object.fromEntries(kept.map((name) => [name, `theirs ${name}`]));
	const run = ["pid", "active", "cost", "tool-calls", "activity", "result", "commits", "budget", "continue", "cpu", "memory", "feature", "feature-cpu", "feature-memory"];
	const theirs = Object.fromEntries(run.map((name) => [name, `theirs ${name}\n`]));
	byHand(machine, { [job.id]: { ...sent, ...theirs, branch: "side", project: "other", hold: "theirs" } });
	await jobs.sweep();
	assert.deepEqual(kept.map((name) => read(home, job.id, name)), spawned, "the spawn's keys stay");
	assert.equal(existsSync(join(home, "jobs", job.id, "hold")), false);
	assert.deepEqual(Object.fromEntries(run.map((name) => [name, read(home, job.id, name)])), theirs, "every file of the run is copied");
	assert.equal(read(home, job.id, "state"), "ended");
	assert.equal(refs(), [...before.split("\n"), `refs/heads/${job.branch} ${tip}`].sort().join("\n"), "only arthur/<id> is fetched, side as it was");
	assert.deepEqual(calls().filter((call) => call.includes("git-upload-pack")).map((call) => call.split(" ").at(-1)), [`'${there}/repos/acme.git'`]);
	assert.deepEqual(events(home, "job-ended"), [{ id: job.id, kind: "worker", project: "acme", state: "ended", reason: "finished" }]);
	writeFileSync(gate, "");
});

test("a record here whose branch is not arthur/<id> refuses the job's copy, naming it, nothing written or fetched; a job without a branch fetches none", async () => {
	const gate = join(temporaryFolder(), "go");
	const { root, home, machine, there, jobs } = setup({ agent: fakeAgent({ steps: [{ waitFor: gate }, { message: "Done." }] }) });
	const role = join(temporaryFolder(), "reviewer.md");
	writeFileSync(role, "# Reviewer\n");
	jobs.registerRole("delivery", { name: "reviewer", file: pathToFileURL(role), criteria: [] });
	jobs.registerKind("delivery", { name: "review", readOnly: true, role: "reviewer" });
	const [job, review] = [await jobs.spawn({ task: "Go.", machine: "gpu" }), await jobs.spawn({ task: "Review it.", kind: "review", machine: "gpu" })];
	await jobs.sweep();
	assert.equal(read(home, review.id, "branch"), "");
	byHand(machine, { [review.id]: { result: "PASS" } });
	await jobs.sweep();
	assert.deepEqual(["state", "result"].map((name) => read(home, review.id, name)), ["ended", "PASS"]);
	assert.equal(calls().filter((call) => call.includes("git-upload-pack")).length, 0, "nothing is fetched for a job without a branch");
	const worktree = join(there, "repos/.arthur-worktrees", job.id);
	commit(worktree, "the change");
	git(worktree, "branch", "side", "HEAD");
	git(root, "branch", "side");
	writeFileSync(join(home, "jobs", job.id, "branch"), "side");
	const refs = git(root, "for-each-ref", "--format=%(refname) %(objectname)");
	byHand(machine, { [job.id]: { cost: "0.5000" } });
	await assert.rejects(jobs.sweep(), { message: `machine gpu: job ${job.id}: names the branch "side" in its record here; expected arthur/${job.id} or none` });
	assert.equal(git(root, "for-each-ref", "--format=%(refname) %(objectname)"), refs, "side's tip is unchanged");
	assert.deepEqual(["state", "cost"].map((name) => read(home, job.id, name)), ["working", "0.0000"]);
	writeFileSync(gate, "");
});

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { delimiter, join } from "node:path";
import { type TestContext, test } from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { oomKills, watchMemory } from "../src/job-memory.ts";
import { temporaryFolder } from "../src/testing.ts";

// The scope of a job `acme` and of its continued run, and another job's, as systemd names them.
const [UNIT, CONTINUED, OTHER] = ["arthur-job-2026-10-16-worker-0a1b2c3d.scope", "arthur-job-2026-10-16-worker-0a1b2c3d.1795548579320.scope", "arthur-job-2026-10-16-review-4e5f6a7b.scope"];
const SLICE = "/user.slice/user-1000.slice/user@1000.service/arthur.slice/arthur-jobs.slice";
// The two lines the kernel logs for a process it kills at a cgroup's cap, as `journalctl -k -o cat` prints them (Linux 6.8).
const kill = (unit: string, pid: number, name = "bun"): [string, string] => [
	`oom-kill:constraint=CONSTRAINT_MEMCG,nodemask=(null),cpuset=user.slice,mems_allowed=0,oom_memcg=${SLICE},task_memcg=${SLICE}/${unit},task=${name},pid=${pid},uid=1000`,
	`Memory cgroup out of memory: Killed process ${pid} (${name}) total-vm:42129440kB, anon-rss:16654488kB, file-rss:32000kB, shmem-rss:0kB, UID:1000 pgtables:43076kB oom_score_adj:1000`,
];
const kernel = (lines: readonly string[]) => lines.map((line) => `the kernel: ${line}`);
const ABOVE = "the kernel killed a process of the job, out of memory at a cap above the job: the one all jobs share, or the machine's";

// A `journalctl` first on `PATH` until the test ends, or no command at all (`none`): it notes each call's arguments in `calls`,
// one line each, and prints the file `<folder>/out.<n>` at its call `n`, else `<folder>/out`, at first one kill in `UNIT`, and
// `<folder>/err` on stderr; as journalctl 255 off a terminal, it prints nothing and exits 1 when it has no entry. Each of
// `ends` is awaited before `PATH` is put back.
type Journal = { readonly folder: string; readonly calls: () => string[]; readonly ends: (() => Promise<unknown>)[] };
function journal(t: TestContext, none = false): Journal {
	const folder = temporaryFolder();
	const script = ["#!/bin/sh", `cd '${folder}'`, `printf '%s\\n' "$*" >> calls`, 'n=$(grep -c "" calls)', "f=out", 'if [ -e "out.$n" ]; then f="out.$n"; fi', "if [ -e err ]; then cat err >&2; fi", '[ -s "$f" ] || exit 1', 'cat "$f"'];
	if (!none) writeFileSync(join(folder, "journalctl"), `${script.join("\n")}\n`, { mode: 0o755 });
	writeFileSync(join(folder, "out"), `${kill(UNIT, 100).join("\n")}\n`);
	const saved = process.env.PATH;
	const ends: (() => Promise<unknown>)[] = [];
	t.after(async () => {
		for (const end of ends) await end();
		process.env.PATH = saved;
	});
	process.env.PATH = none ? folder : [folder, saved].join(delimiter);
	return { folder, calls: () => (existsSync(join(folder, "calls")) ? readFileSync(join(folder, "calls"), "utf8").trimEnd().split("\n") : []), ends };
}

test("oomKills asks the kernel's log once and names each process killed in the scope, none of another scope or of its continued run", async (t) => {
	const { folder, calls } = journal(t);
	// A pid that starts with the scope's, and a line of the kernel that is no kill.
	const all = [...kill(OTHER, 1000), ...kill(UNIT, 100), ...kill(CONTINUED, 200, "node"), "oom_reaper: reaped process 100 (bun), now anon-rss:0kB, file-rss:0kB, shmem-rss:0kB"];
	writeFileSync(join(folder, "out"), `${all.join("\n")}\n`);
	assert.deepEqual(await oomKills(UNIT, 1_795_000_000_999), kernel(kill(UNIT, 100)));
	assert.deepEqual(calls(), ["-k -o cat --no-pager --since=@1795000000 --grep=oom-kill:|Killed process"]);
	assert.deepEqual(await oomKills(CONTINUED, 1_795_000_001_000), kernel(kill(CONTINUED, 200, "node")));
	assert.equal(calls()[1], "-k -o cat --no-pager --since=@1795000001 --grep=oom-kill:|Killed process");
});

test("oomKills names a process killed as the machine itself ran out of memory, whose lines name no cgroup's cap", async (t) => {
	const { folder } = journal(t);
	// The two lines of a kill at no cgroup's cap, as mm/oom_kill.c writes them: `global_oom` in place of `oom_memcg=`.
	const lines = [
		`oom-kill:constraint=CONSTRAINT_NONE,nodemask=(null),cpuset=/,mems_allowed=0,global_oom,task_memcg=${SLICE}/${UNIT},task=node,pid=300,uid=1000`,
		"Out of memory: Killed process 300 (node) total-vm:42129440kB, anon-rss:16654488kB, file-rss:32000kB, shmem-rss:0kB, UID:1000 pgtables:43076kB oom_score_adj:1000",
	];
	writeFileSync(join(folder, "out"), `${lines.join("\n")}\n`);
	assert.deepEqual(await oomKills(UNIT, 0), kernel(lines));
});

test("oomKills names two kills in one scope, each kill's line of the cap first, then each one's process", async (t) => {
	const { folder, calls } = journal(t);
	const [first, second] = [kill(UNIT, 100), kill(UNIT, 101, "node")];
	writeFileSync(join(folder, "out"), `${[...first, ...second].join("\n")}\n`);
	assert.deepEqual(await oomKills(UNIT, 0), kernel([first[0], second[0], first[1], second[1]]));
	assert.equal(calls().length, 1);
});

test("oomKills asks again until the kernel's log holds the killed process's line, and stops there", async (t) => {
	const { folder, calls } = journal(t);
	const [cap, process] = kill(UNIT, 100);
	// Nothing at the first call, the kill without its process at the second, both from the third on.
	writeFileSync(join(folder, "out.1"), "");
	writeFileSync(join(folder, "out.2"), `${cap}\n`);
	writeFileSync(join(folder, "out"), `${cap}\n${process}\n`);
	assert.deepEqual(await oomKills(UNIT, 0), kernel([cap, process]));
	assert.equal(calls().length, 3);
	// A second kill whose process line is not there yet is waited for as well.
	writeFileSync(join(folder, "out.4"), `${cap}\n${process}\n${kill(UNIT, 101)[0]}\n`);
	writeFileSync(join(folder, "out"), `${[...kill(UNIT, 100), ...kill(UNIT, 101)].join("\n")}\n`);
	assert.equal((await oomKills(UNIT, 0)).length, 4);
	assert.equal(calls().length, 5);
});

test("oomKills asks again 100 ms after a call whose lines are not all there yet, not sooner", async (t) => {
	// Fake time: the test sees the retry's exact rhythm, not one a slow runner stretches. job-memory.ts imports its sleep by name,
	// which the mock reaches only once the builtin's named exports are synced; a retry still pending at the end is dropped.
	t.mock.timers.enable({ apis: ["setTimeout"] });
	syncBuiltinESMExports();
	t.after(() => {
		t.mock.timers.reset();
		syncBuiltinESMExports();
	});
	const { folder, calls } = journal(t);
	writeFileSync(join(folder, "out.1"), "");
	const asked = oomKills(UNIT, 0);
	assert.equal(calls().length, 1);
	t.mock.timers.tick(99);
	await nextTurn();
	assert.equal(calls().length, 1, "no second call 1 ms before 100 ms");
	t.mock.timers.tick(1);
	await nextTurn();
	assert.equal(calls().length, 2);
	assert.deepEqual(await asked, kernel(kill(UNIT, 100)));
});

test("oomKills gives up after its tries, 20 unless told: with what the log holds, or one line that says why it names none", async (t) => {
	const { folder, calls } = journal(t);
	const [cap] = kill(UNIT, 100);
	writeFileSync(join(folder, "out"), `${cap}\n${kill(OTHER, 1000).join("\n")}\n`);
	assert.deepEqual(await oomKills(UNIT, 0, 3), kernel([cap]));
	assert.equal(calls().length, 3);
	// A log the user may not read: journalctl says so on stderr, in several lines, and has no entry.
	writeFileSync(join(folder, "out"), "");
	writeFileSync(join(folder, "err"), "Hint: You are currently not seeing messages from other users and the system.\n      Users in groups 'adm', 'systemd-journal' can see all messages.\n      Pass -q to turn off this notice.\n");
	assert.deepEqual(await oomKills(UNIT, 0, 2), [`the kernel's log names no process killed in ${UNIT}; journalctl -k: Hint: You are currently not seeing messages from other users and the system.`]);
	assert.equal(calls().length, 5);
	rmSync(join(folder, "err"));
	assert.deepEqual(await oomKills(UNIT, 0, 1), [`the kernel's log names no process killed in ${UNIT}; journalctl -k: no such line`]);
	assert.equal(calls().length, 6);
	assert.deepEqual(await oomKills(UNIT, 0), [`the kernel's log names no process killed in ${UNIT}; journalctl -k: no such line`]);
	assert.equal(calls().length, 26);
});

test("oomKills without a journalctl says so in its one line", async (t) => {
	journal(t, true);
	assert.deepEqual(await oomKills(UNIT, 0, 2), [`the kernel's log names no process killed in ${UNIT}; journalctl -k: spawnSync journalctl ENOENT`]);
});

// A job's scope as cgroup v2 shows it, in a folder of the test's: its `memory.events` and the `memory.events.local` of the slice
// that holds it, their counts not at 0, as in a slice that saw kills before; `count` sets one of them. The watch of the scope,
// with what `over` and `note` heard; it ends with the test, before `fake`'s journalctl goes.
function watched(fake: Journal, cap = "", ticket = "", ticketCap = "") {
	const slice = join(temporaryFolder(), "arthur-jobs.slice");
	const scope = join(slice, UNIT);
	mkdirSync(scope, { recursive: true });
	const files = { oom: join(scope, "memory.events"), oom_kill: join(scope, "memory.events"), slice: join(slice, "memory.events.local") };
	const counts = { oom: 2, oom_kill: 3, slice: 32 };
	const count = (key: keyof typeof counts, value: number) => {
		counts[key] = value;
		writeFileSync(files.oom, `low 0\nhigh 0\nmax 7\noom ${counts.oom}\noom_kill ${counts.oom_kill}\noom_group_kill 0\n`);
		writeFileSync(files.slice, `low 0\nhigh 0\nmax 22848\noom ${counts.slice}\noom_kill 0\noom_group_kill 0\n`);
	};
	count("oom", 2);
	const [heard, notes]: [string[], string[]] = [[], []];
	const watch = watchMemory("acme", cap, ticket, ticketCap, (what) => heard.push(what), (line) => notes.push(line), 10_000, scope);
	fake.ends.push(watch.end);
	return { ...watch, count, heard, notes, events: files.oom };
}

test("a watched scope that counts no new kill is not over: check and end say nothing, and the kernel's log is not asked", async (t) => {
	const fake = journal(t);
	const { check, end, heard, notes } = watched(fake);
	assert.equal(check(), undefined);
	assert.equal(await end(), undefined);
	assert.deepEqual([heard, notes, fake.calls()], [[], [], []]);
});

test("a kill in a scope without caps is one at a cap above the job: check says so, over hears it once, and end notes the kernel's lines", async (t) => {
	const fake = journal(t);
	writeFileSync(join(fake.folder, "out"), `${[...kill(OTHER, 1000), ...kill(UNIT, 100)].join("\n")}\n`);
	const { check, end, count, heard, notes } = watched(fake);
	count("oom_kill", 4);
	assert.equal(check(), ABOVE);
	assert.equal(check(), ABOVE);
	assert.deepEqual(heard, [ABOVE]);
	assert.deepEqual(notes, []);
	assert.equal(await end(), ABOVE);
	assert.deepEqual([heard, notes], [[ABOVE], kernel(kill(UNIT, 100))]);
	assert.match(fake.calls()[0] ?? "", /^-k -o cat --no-pager --since=@\d{10} /);
});

test("the watch samples a scope without caps every 1000 ms on its own, and over hears a kill without a check", (t) => {
	t.mock.timers.enable({ apis: ["setInterval"] });
	const { count, heard } = watched(journal(t));
	count("oom_kill", 4);
	t.mock.timers.tick(999);
	assert.deepEqual(heard, [], "no sample 1 ms before a second");
	t.mock.timers.tick(1);
	assert.deepEqual(heard, [ABOVE]);
});

test("a kill since the last sample is told by end alone: over does not hear it, the kernel's lines are noted", async (t) => {
	const { check, end, count, heard, notes } = watched(journal(t));
	count("oom_kill", 4);
	assert.equal(await end(), ABOVE);
	assert.deepEqual([heard, notes], [[], kernel(kill(UNIT, 100))]);
	// Once ended, a check says the same and over still hears nothing.
	assert.equal(check(), ABOVE);
	assert.deepEqual(heard, []);
});

test("the scope's own oom is the job's cap, its ticket's slice's oom with a kill the ticket's, a kill beside neither a cap above", (t) => {
	const fake = journal(t);
	const [own, theirs] = ["the job went over its memory cap of 300M", "the jobs of ticket AC0001 went over their memory cap of 400M"];
	const capped = watched(fake, "300M");
	capped.count("oom", 3);
	capped.count("oom_kill", 4);
	assert.equal(capped.check(), own);
	// Both caps reached: the job's own is said.
	const both = watched(fake, "300M", "AC0001", "400M");
	both.count("slice", 33);
	both.count("oom", 3);
	both.count("oom_kill", 4);
	assert.equal(both.check(), own);
	const ticket = watched(fake, "", "AC0001", "400M");
	ticket.count("slice", 33);
	// The slice's cap killed a process of another of the ticket's jobs so far.
	assert.equal(ticket.check(), undefined);
	ticket.count("oom_kill", 4);
	assert.equal(ticket.check(), theirs);
	assert.deepEqual(ticket.heard, [theirs]);
	const above = watched(fake, "300M", "AC0001", "400M");
	above.count("oom_kill", 4);
	assert.equal(above.check(), ABOVE);
});

test("a scope whose counts cannot be read at a check is not over, and the check does not throw; one without the memory controller is not watched", async (t) => {
	const { check, count, heard, events } = watched(journal(t));
	count("oom_kill", 4);
	rmSync(events);
	assert.equal(check(), undefined);
	assert.deepEqual(heard, []);
	count("oom_kill", 4);
	assert.equal(check(), ABOVE);
	const bare = watchMemory("acme", "", "", "", () => assert.fail("over"), () => assert.fail("note"), 10_000, temporaryFolder());
	assert.equal(bare.check(), undefined);
	assert.equal(await bare.end(), undefined);
});

test("without a scope the watch sums the processes with ps every sampleMs against the job's cap, and without a cap runs no ps", async (t) => {
	const folder = temporaryFolder();
	// A `ps` first on `PATH` that notes each call and prints no process: the sum stays 0, under any cap.
	writeFileSync(join(folder, "ps"), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${folder}/calls'\n`, { mode: 0o755 });
	const saved = process.env.PATH;
	t.after(() => (process.env.PATH = saved));
	process.env.PATH = [folder, saved].join(delimiter);
	const calls = () => (existsSync(join(folder, "calls")) ? readFileSync(join(folder, "calls"), "utf8").trimEnd().split("\n") : []);
	t.mock.timers.enable({ apis: ["setInterval"] });
	const none = watchMemory("acme", "", "", "", () => assert.fail("over"), () => assert.fail("note"), 50, "");
	t.mock.timers.tick(50);
	assert.deepEqual(calls(), [], "nothing to watch: no ps");
	const capped = watchMemory("acme", "300M", "", "", () => assert.fail("over"), () => assert.fail("note"), 50, "");
	t.mock.timers.tick(49);
	assert.deepEqual(calls(), []);
	t.mock.timers.tick(1);
	assert.deepEqual(calls(), ["-A -o pid=,ppid=,pgid=,rss=,args="]);
	assert.deepEqual([await none.end(), await capped.end()], [undefined, undefined]);
});

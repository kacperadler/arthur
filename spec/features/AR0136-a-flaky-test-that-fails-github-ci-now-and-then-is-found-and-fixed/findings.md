# AR0136 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

How the flaky tests were found: `npm test` run 6 at a time on a 7-core machine (load average about 60), each run with Node's default `--test-concurrency` as CI uses it, and the orchestration test files 10 at a time beside 10 busy-looping `node` processes. 6 runs of the unchanged tree: 5 failed, on F2, F3 and F4. Each failure is also reproduced at will, as said below.

## F1. The inbox test reads `job-ended` before the wrapper emitted it

- Kind: bug
- Found by: 2026-10-18-ar0136-flaky-test-6f928022 (worker), 2026-10-18
- Where: `packages/orchestration/test/inbox.test.ts:189` ("job ends and a schedule message mid-turn wait for the next turn..."), and the same read in `:425` ("the footer names the running jobs...")
- What: the ticket's suspect. Failing assertion: `assert.deepEqual(box.messages()[2], { content: wake, ... })`; the wake starts `[Arthur] Job 2026-10-17-worker-0000abcd ended its run blocked...` and lacks the paragraph `[Arthur] Job <id> ended its run: ended (finished).`. Cause: the test waited until the job's `result` was written and `jobs.running()` was empty, then read `job-ended` from the event log; the wrapper writes `state` (`moveJob`) before it emits `job-ended` (`packages/core/src/wrapper.ts:170-176`, as `docs/commands/stop.md` says: state last, then `job-ended`), so in that gap the read finds no event, the test emits `job-ended` with no data, and the inbox ignores it. Reproduced every time with a 1.5 s `Atomics.wait` put before the wrapper's emit: the test fails with exactly that diff. The footer test emitted `undefined` the same way, but its footer clears without the event, so it passed.
- Suggestion: wait for the `job-ended` event itself (`jobEnded` in the test). With the same 1.5 s delay both tests pass. Production keeps its order: the documented `state` last, then the event.
- Status: fixed in fed4c7c

## F2. The context test compares two readings of the wall clock's minute

- Kind: bug
- Found by: 2026-10-18-ar0136-flaky-test-6f928022 (worker), 2026-10-18
- Where: `packages/orchestration/test/context.test.ts:166` ("before every turn the extension adds what arthur coordinator context prints then...")
- What: failing assertion `assert.deepEqual(second, [BASE, printed])`: `+ "12:05 on sun 2026-10-18 (UTC), ..."` against `- "12:06 on ..."`, in 2 of the 6 loaded runs. Cause: each turn's `## Time` line is the minute when `arthur coordinator context` ran for that turn, and the test runs that command again afterwards; whenever the test spans a minute boundary the lines differ, on a slow runner or not (an unloaded run of the test takes about a second, so roughly one run in 60 [INFERENCE]). Reproduced every time by waiting into the next minute before the test's own `arthur coordinator context`.
- Suggestion: compare the turns' prompts with the clock part of the `## Time` line masked; the test with a set clock (`context.test.ts`, the quiet-hours test) still checks that line. With the same wait the fixed test passes.
- Status: fixed in fed4c7c

## F3. The SIGKILL test allowed 1 s past the grace

- Kind: bug
- Found by: 2026-10-18-ar0136-flaky-test-6f928022 (worker), 2026-10-18
- Where: `packages/core/test/job-control.test.ts:120` ("arthur stop of an agent that ignores SIGTERM: SIGKILL to its group after the grace...")
- What: failing assertion `took < (GRACE_SECONDS + 1) * 1000`: `stopped after 6060 ms` and `stopped after 6398 ms`, in 2 of the 6 loaded runs. Cause: the ceiling left 1 s for the SIGKILL, the wrapper's end and the test's polling; a loaded runner needs more.
- Suggestion: a ceiling of `GRACE_SECONDS + 5`, still below the `GRACE_SECONDS + 10` after which `arthur stop` gives up.
- Status: fixed in fed4c7c

## F4. The sweep tests use a fixed job id that the whole process table is searched for

- Kind: bug
- Found by: 2026-10-18-ar0136-flaky-test-6f928022 (worker), 2026-10-18
- Where: `packages/core/test/job-records.test.ts:213` and `:245` ("the sweep ends a working or idle job..." and "the sweep keeps a working job whose wrapper runs before it wrote its pid...")
- What: failing read `field(home, id, "reason")`: `ENOENT ... jobs/2026-10-16-worker-0000000a/reason`, the job never ended, in 3 of 4 runs side by side and then 3 of 6 loaded runs. Cause: the sweep looks for a wrapper of the id in every process of the machine (`wrappers(id)` in `packages/core/src/job-control.ts:31` matches `/wrapper.ts ` and the id, any home), and the second test starts a stand-in wrapper process for `2026-10-16-worker-0000000a`; another test run on the same machine that is in the first test at that moment sees that process as its own job's wrapper. Only test runs side by side hit it, a single CI run does not [INFERENCE]; a production collision needs two homes with the same 8 random hex digits.
- Suggestion: random ids in both tests.
- Status: fixed in fed4c7c

## F5. Other timing bounds sized for a fast machine

- Kind: bug
- Found by: 2026-10-18-ar0136-flaky-test-6f928022 (worker), 2026-10-18
- Where: `packages/core/test/job-control.test.ts:176`, `packages/core/test/limits.test.ts:181`, `packages/core/test/machine.test.ts:443`, `packages/machines/test/machines.test.ts:202`, `packages/orchestration/test/coordinator.test.ts:104`, `packages/orchestration/test/inbox.test.ts:259`, `:319`, `:340`, `:363`
- What: the same pattern as F3, not seen failing in these runs: ceilings 1 to 1.5 s above the expected time (3 s for a 2 s pipe wait; `GRACE_SECONDS + 1`; 2 s against a 3 s `sleep`; 14 s for one 10 s round; `1\.\d s later` for a 1 s wait; 2 s, 6.5 s, 11.5 s for the 0, 5 and 10 s redelivery waits; 1.5 s for the next tick against a wait that ends about 3 s later), and floors measured from when the test saw a signal rather than from the moment the waited time starts (the grace from the test seeing the log line, with 100 ms slack; the 30 s idle from the test seeing the turn).
- Suggestion: each ceiling sits below the next wrong behaviour's time with seconds to spare (two checks in a row, 20 s; the holder's 300 s; the next doubling of the wait); the gap the 0.3 s run limit and the owner's message must land in is held open (`sleep 10`, a 10 s wait after three failed turns); the floors count from the wrapper's own log time or from before the message.
- Status: fixed in fed4c7c

## F6. The burst test still relies on the test's 300 ms timers staying under a second

- Kind: risk
- Found by: 2026-10-18-ar0136-flaky-test-6f928022 (worker), 2026-10-18
- Where: `packages/orchestration/test/inbox.test.ts:173` ("several messages while idle, each within a second of the last, are one turn, in order")
- What: the test sends four messages 300 ms apart and expects one turn; the inbox extension hands the queue over once it has not grown for `SETTLE_MS` (1 s) by `Date.now()` in the agent's process (`packages/orchestration/src/inbox-extension.ts:143`). A test process stalled for 700 ms between two messages would see them split into two turns. It passed every one of the 20 orchestration runs under load and the 6 full loaded runs; the gap cannot be held open from the test, since the extension reads the real clock.
- Suggestion: give the extension's clock a test seam (the fake agent could pass one in), so the test moves time instead of sleeping; that touches production code, out of AR0136's scope.
- Status: ticket AR0137

## F7. The daemon test expects one order of two processes' lines in a shared log

- Kind: bug
- Found by: 2026-10-18-ar0136-flaky-test-6f928022 (worker), 2026-10-18
- Where: `packages/core/test/run.test.ts:151` ("an event a command emits reaches the daemon's subscribers once, from the daemon's start until its plugins stop")
- What: failing assertion `assert.equal(log(), [...].join("\n"))`, in 1 of the 24 loaded runs of fed4c7c: the command's own line `<pid c> pinged 4 c` came after the daemon's `<daemon> pinged 4 c` and `<daemon> ponged 5`, not before them. Cause: a command's `emit` appends the event to the log and only then delivers it to its own subscribers (`packages/core/src/events.ts:71-79`, as its comment says), while `arthur run` follows the log every 500 ms; a command process held up between the two lets the daemon log first. Production promises no order between two processes' handlers; only the test assumed one. Reproduced every time by holding the command's own subscriber 1.5 s (`Atomics.wait` in the test's config, outside the daemon): the old test fails with that diff, the new one passes.
- Suggestion: check the daemon's lines in order with the commands' own lines left out, and each command's own line once, after the start and before the next command's event reaches the daemon.
- Status: fixed in bf9f6a5

## F8. A coordinator Decisions line was committed on the worker's branch

- Status: dropped (the coordinator recorded its own proof run there because the worker's budget ran out; nothing to change)
- Source: review-1.md

## F9. `limits.test.ts` reads `line[1] ?? ""` into `Date.parse`

- Status: dropped (the capture is always filled by `toISOString()`; review-1 calls it unreachable)
- Source: review-1.md


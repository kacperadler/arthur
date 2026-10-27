# AR0509 - Review 1

- Job: 2026-10-27-review-51250ded
- Branch: arthur/2026-10-27-worker-61d50fad
- Commit reviewed: 2518739c4138d166e8518f27656c57a9abcbab51
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/machine-sync.ts:51` with `packages/core/src/job-machine.ts:95`: nothing on this side limits the size of the copy's answer, and an answer that is too large crashes `arthur run`.**
   - The only size limit is in `records` on the other machine (`remote-job.ts`, `LOG_BYTES`). The main Arthur trusts that side to stay small. The ticket's Input names that side as possibly changed: "a job there without a sandbox … that changed Arthur's install there".
   - `execute` adds every stdout chunk to one string with no maximum. `sshAsync` keeps whatever arrives in the 20 s, and `syncMachine` then runs `JSON.parse` on all of it.
   - **What I ran:** the real `sshAsync(machine, ["arthur","remote-job","records",…], "", 20)` with a fake `ssh` printing 700 MB. The node process died in 9.6 s with an uncaught `RangeError: Invalid string length` thrown from the `data` handler at `job-machine.ts:95`, exit 1. The error comes from a stream event, so `syncMachines`, the sweep's `.catch` and `run.ts` never see it, and the whole of `arthur run` goes down.
   - **Before this branch:** the copy used `spawnSync` with its 1 MiB `maxBuffer`. The ticket's own probe shows an oversized answer was then a caught `ENOBUFS` error, and the process lived on.
   - This is a regression in a security ticket. Its Goal is that "one machine that answers too much … cannot … freeze all of `arthur run`", and that machine can now stop `arthur run` entirely.
   - **What's needed:** a byte limit on what the copy accepts here, enforced locally (kill the child, fail the copy), not only the sender's limit.

2. **`packages/core/test/machine.test.ts:649,653`: the timeout test can leave its fake `records` process running forever.**
   - The fake loops `while [ ! -e gate ]; do sleep 0.1; done` with no other exit.
   - `t.after` writes `gate` inside a kit folder, and the kit deletes that folder at process exit. When this test is the last one in its process, the folder can be gone before the loop's next 100 ms check, so the loop never sees `gate`.
   - **What I saw:** on the unmodified commit, `timeout 120 node --import @arthur/core/testing --test --test-name-pattern='log grown|copy brings only|copy that does not answer' packages/core/test/machine.test.ts` passed 3/3 and left `/bin/sh …/bin/arthur remote-job records …` running after the temp folder was gone. My six runs of this kind left six such loops. One run of the test alone without `timeout` left none, so it is a race.
   - The full `npm test` left none: other tests run after it there.
   - The review criteria fail a test that leaves a resource behind. A deadline in the loop, or a gate outside the kit's folder, would fix it.

## Notes (not blocking)

- `syncMachines` now copies all machines at once (`Promise.all`), and `spawn.md` documents "every machine at once". No test has two machines, so a version that copies one machine after the other would pass. I did not run this mutation.
- Findings F1–F3 in the worker's `findings.md` look right from the code. F3 is new with this branch: a copy can now still be running after `run.pid` is released. The risk is low, because a new run's first sweep comes 30 s later and the copy stops within 20 s.
- The worker also changed `job-control.ts`, `job-records.ts`, `run.ts` and two other test files, which the ticket's Scope does not list. The final message explains why: the copy is now async, so every caller has to await it. The `synced` guard against two copies at once is also explained.
- The timeout check matches on stderr ending with `timed out after <n> s`, which is fragile but correct for how `execute` reports a timeout.

## Checks run

- `npm ci`: OK.
- `npm run check`: exit 0.
- `npm test` (full suite): 1208 tests, 1147 pass, 0 fail, 61 skipped, exit 0. Matches the worker's claim.
- Mutations, each run against the matching tests and restored with `git checkout --` (the tree is clean); every one was caught:
  - M1, removed `if (copy.logTo < copy.logSize) continue;`: "log grown" test fails.
  - M2, `at` always the newest modification time, even when the log was cut: "log grown" fails.
  - M3, no character back-off: "log grown" fails.
  - M4, no 3-byte limit on the back-off: "log grown" fails.
  - M5, removed the `synced` guard: "copy brings only" fails.
  - M6, back-off limit 3 → 4: "log grown" fails.
  - M7, a timeout no longer counts as exit 255: the 20 s test fails.
  - M8, the copy blocks the event loop and has no time limit: the test file hangs and is cancelled, exit 124.
- Size probe: the real `sshAsync` against a fake `ssh` that prints 700 MB crashes the process with an uncaught RangeError, exit 1 (finding 1).
- Leak check: `pgrep` after the focused runs found the leaked loops of finding 2. I killed them, along with the wrapper and agent my cancelled M8 run left behind, and removed my temp folders.

FAIL
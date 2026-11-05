# AR0520 - Review 2

- Job: 2026-11-05-review-0a2c0b39
- Branch: arthur/2026-11-05-worker-d8bfe3a6
- Commit reviewed: 430b3d53f4d74a0fd446700b24c9993afbc43afa
- Verdict: PASS

## Final message

No blocking findings. Both findings from review 1 are fixed and tested, and the branch meets the ticket's Done means.

- **The spawn's SSH steps are bounded and don't block.** In `packages/core/src/job-machine.ts:155-169`, `reach`, `addThere` and `removeThere` now use `sshAsync` with a 60 s limit and a 1 MiB output limit. The push of a base has its own 600 s limit (`PUSH_SECONDS`, line 162), and its error now starts with the machine's name.
- **The sweep's fetch is bounded and doesn't block.** In `packages/core/src/machine-sync.ts:88-90`, the fetch of an ended job's branch is awaited with a time limit. The new `mark` check skips a job that another sweep ended during the fetch.
- **The tests cover the limits and the non-blocking.** In `machine.test.ts`, the 60 s test has the spawn and the sweep both fail at their limit while a timer keeps ticking during the wait, and the next sweep then brings the branch. The push test runs on fake time and checks the push is still running at 599 999 ms and fails at 600 000 ms. The add/launch/remove test only passes if the process stays free while each step runs.
- **The docs match the code.** `spawn.md` lines 36, 53 and 64 describe the new limits and messages, including `arthur remote-job records:` now named in the copy's cut messages. The old wording is gone from the other docs.

## Notes
- (risk) packages/core/src/job-records.ts:65,164: `steer` and `prune` still use the blocking `ssh`, so each can freeze `arthur run` for up to 60 s. This is recorded as F1 in `findings.md` and is outside the Scope's In list.
- (risk) packages/core/src/job-machine.ts:95: when `gitOver` hits its limit, it kills only `git`, so the `ssh` that git started keeps running. This is recorded as F2 in `findings.md`.
- (minor) packages/core/src/jobs.ts:139-155: the file is outside the Scope's In list, but the only change is adding `await` where the functions became async, and the worker's message says so.
- (minor) packages/core/src/job-machine.ts:146: a fetch or push that hits its limit carries no `cause` 255, so the sweep doesn't mark the machine unreachable for it. The worker's final message now states this correctly.

## Checks
All on 430b3d53:
- **`npm run check`** (timeout 1800): tsc reported no errors.
- **`npm test`** (timeout 1800): 1562 tests, 1498 pass, 0 fail, 0 cancelled, 64 skipped. My first call ran check and the tests together, but its summary filter caught no lines, so I ran `npm test` again on its own; that second run gave these counts.
- **Hand mutation:** I changed `addThere` back to the blocking `ssh` and ran `node --import @arthur/core/testing --test --test-name-pattern="add, launch and remove there wait" packages/core/test/machine.test.ts`. The test caught it: pass 0, fail 1. I restored the file with `git checkout -- packages/core/src/job-machine.ts`, and `git status --short` showed nothing.
- **Not run:** `npm run mutate`, because the budget was small. The two survivors from review 1 (`job-machine.ts:168` and `:24`) are now covered by the new tests: I checked the first by hand above, and the second by reading the push test.

PASS
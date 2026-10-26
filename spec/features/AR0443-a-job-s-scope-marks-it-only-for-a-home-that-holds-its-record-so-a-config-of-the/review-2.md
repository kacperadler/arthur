# AR0443 - Review 2

- Job: 2026-10-26-review-765e0974
- Branch: arthur/2026-10-26-worker-1bf07670
- Commit reviewed: 7b32ec3eec3f1d9be76b4c2969847e46e8e2330a
- Verdict: FAIL

## Final message

I'm failing this: `npm test` is still not reliable on this branch, because the sandbox's start walk makes the test that review 1 named in limits.test.ts fail. The new wait in `job-control.test.ts` is correct and does not weaken that test.

## Findings

1. **`packages/core/src/job-sandbox.ts:99`: each sandboxed start still walks the folders above the hidden env file, and that makes `limits.test.ts` "an agent that ignores SIGTERM at its limit gets SIGKILL after the grace … stops at its budget" fail.**
   - The coordinator's full `npm test` on the host gave 1165 pass, 1 fail, and this is the one that failed.
   - In my checkout it also fails when run alone: 2 runs out of 2, each failing with `Error: timed out waiting for the stop at the budget` after 20 s. It is not only a failure under load.
   - It is caused by the walk:
     - With all of `packages/core/src` checked out at base `0e5ab024`, the same test passes (1/1).
     - With only the start's `...hidden` removed from line 99 (so no walk), it passes (1/1).
   - Why: the walk costs about 0.25 s, and the job's limit in this checkout is `timeoutMinutes: 0.005` (0.3 s; the coordinator saw 0.01, which is 0.6 s). So the time limit can fire before the fake agent writes its `message_end`, and the job never reaches "stopping the agent" at its budget.
   - This breaks the ticket's "`npm test` … pass". The worker reported `limits.test.ts` 17/17 twice; here it was 16/17, so that claim does not reproduce.
   - The worker's final message says F1 (perf) is still open, so the worker knew. The branch ships with a failing suite anyway.

## Notes
- **The new wait at `job-control.test.ts:636` (the worker's ":621" is the test's first line) fixes a real race and does not weaken the test.**
  - The job's `running` state is written before python finishes the walk and starts the agent. So steer and stop could kill the job before the fake agent recorded its start.
  - The test's later check, `starts(agent).length === 1` after the refused `continue`, needs that first start to have happened. The wait checks exactly that, so it is a check the test needed, not a looser one.
  - If the agent never started, `until` would time out and the test would fail. Every steer, stop, refusal and usage assertion is unchanged.
- **The probe no longer passes `hidden`, so it no longer tests the read rule.** This is safe: Landlock handles the file-read right from its first version, and errors in the walk were already ignored.
- **Each start now pays for one walk instead of two.** The fix for finding 1 still has to get the walk below the job time limits the tests use, or make those tests not depend on how long the start takes.
- **The core budget of 6269 is decided (AR-D81)**, so it is not a finding.

## Checks
- `npm ci` and `npm run check`: exit 0.
- `node --test packages/core/test/sandbox.test.ts`: 12 tests, 8 pass, 0 fail, 4 skipped. The 4 need a Unix socket, which this job's sandbox refuses.
- `node --test packages/core/test/job-control.test.ts`: 30 tests, 28 pass, 0 fail, 2 skipped.
- `node --test packages/core/test/limits.test.ts`: 17 tests, 16 pass, 1 fail (the SIGTERM/budget test). Rerun alone: 0/1 pass.
- The same test with `packages/core/src` at base: 1/1 pass.
- The same test with no walk at start (`...hidden` dropped from the return at line 99): 1/1 pass.
- All throwaway changes are restored and `git status` is clean.

FAIL
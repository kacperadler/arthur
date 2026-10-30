# AR0578 - Review 1

- Job: 2026-10-30-review-c525d62c
- Branch: arthur/2026-10-30-worker-f9e3eee7
- Commit reviewed: eb4a3d53e0e98d9a964329a3f89d284cdac22e98
- Verdict: PASS

## Final message

No blocking findings. The branch meets every point in "Done means". `npm run check` and `npm test` pass in my checkout, the structure check rejects every case it was built to catch, and every changed wait still waits for the state its test asserts.

## Findings

None.

## Notes (not blocking)

- **Ways past the structure check.** I fed `test/structure.ts` a test file in a throwaway tree, with no wait baseline. These forms produced no error:
  - `import { setTimeout as delay } from "node:timers/promises"; while (!done()) await delay(10);` gets past both the loop rule and the wait count. `test/structure.ts:23-24` only match the names `sleep` and `setTimeout`, so any other alias escapes.
  - `while (!done()) await scheduler.wait(10);` is also not seen.
  - A `setInterval` poll wrapped in a `Promise` is also not seen.
  - A regex literal holding a quote or backtick throws the rest of the file off. The worker already filed this as F1.

  The `sleep` form the repo uses everywhere is counted. A loop split over several lines, a `timers.setTimeout` call and an `until` written as a method are each caught by the loop rule or the wait count. Matching any alias of an import from `node:timers/promises` would close the alias gap cheaply.
- **The 20 s default deadline is untested.** In `packages/core/src/until.ts:5`, changing `deadlineMs = 20_000` to `2_000` leaves `testing.test.ts` passing. That default is what keeps tests from timing out under load. Two other mutations also pass, but they are minor: changing `>` to `>=`, and polling every 200 ms instead of 20 ms.
- **`job-control.test.ts:500`** still polls with `Atomics.wait` in a loop. The loop rule only knows `sleep` and `setTimeout`, so this loop is allowed through the file's baseline of 1 instead. The worker explains why (inside a synchronous mocked function `until` can't be awaited) and filed it as F2.
- **Small behaviour changes in migrated tests, all safe:**
  - `run.test.ts` now waits up to 20 s instead of 10 s; `resources.test.ts` likewise instead of 10 s.
  - `spawn.test.ts` now throws when time runs out instead of falling through to the assertion.
  - `worktree-guard.test.ts`'s own `until` used to return `false`. Its callers all return `true` or `undefined`, so this changes nothing.
- **The test kit's line budget** goes from 357 to 369 (+12), as the plan estimated. The 12 lines are `until.ts` (11) plus one export line in `testing.ts`.

## Checks run

- **Full check:** `npm ci && npm run check && npm test` in one call with an 1800 s timeout, 461 s wall time. `tsc` was clean and `npm test` exited 0 with no `not ok` lines, so `limits.test.ts` passed under the full suite's load.
- **Old structure checker against the new tests:** with the base `test/structure.ts` put back, the branch's `structure.test.ts` gave 14 passed, 4 failed. The failures are the repository test, the test-kit test and both new rule tests, as the worker said. The file was restored afterwards.
- **Mutations of `test/structure.ts`:** each of these made `node --test test/structure.test.ts` fail:
  - the own-`until` pattern disabled;
  - its `const`/`let`/`var` part removed;
  - the loop pattern disabled;
  - the wait allowance raised by one (`waits > allowed + 1`);
  - the wait allowance lowered by one (`waits >= allowed`);
  - `Atomics.wait` dropped from the wait count;
  - packages' `test/` folders skipped;
  - the root `test/` skipped.
- **Mutations of `until.ts`:**
  - Caught: accepting `false`, and ending 100 ms early.
  - Not caught: the three listed in the notes.
- **Unchanged file:** `node --test test/structure.test.ts` gave 18 of 18 passing.
- **Counts:** 36 test files declared their own `until` on the base, 0 on the tip (only the strings in the structure test's own examples remain). Test kit total is 369 lines (`wc -l`), against 194 base lines for `testing.ts` (357 overall).
- **Clean up:** all mutations restored; `git status` is clean.

PASS
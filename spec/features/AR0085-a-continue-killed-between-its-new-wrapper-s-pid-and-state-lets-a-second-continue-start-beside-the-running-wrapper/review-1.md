# AR0085 - Review 1

- Job: 2026-10-17-review-ar0085-continue-r-7690f2d7
- Branch: h/2026-10-17-ar0085-continue-race-4b1ca44c
- Commit reviewed: 9a9c3017f24b75ec8373436109f398bd384ba4f9
- Verdict: PASS

## Final message

Branch correctly closes the gap: `continueJob` now waits for every wrapper of the job (matched robustly by command line, catching one that hasn't written `pid` yet) before writing anything, and refuses after the 5s grace instead of launching a second wrapper as before. The sweep is updated the same way so it never ends a record whose wrapper is alive but pid-less. `stopJob` is updated only because of the rename (`wrapperRuns`→`wrappers`), a required cutover, not scope creep.

**Mutation checks (own worktree, each reverted via `git checkout --`):**
- Removed the wait loop in `continueJob` → new decoy test fails with "Missing expected rejection" (confirms the wait is load-bearing).
- Loosened `wrappers()` to the old `includes("wrapper.ts") && includes(id)` style → both new tests fail (the `continue <id> fix .../wrapper.ts` decoy gets counted as a second wrapper; continue's error message lists two pids instead of one, and the sweep wrongly ends the job).
- Changed sweep's `alive` check back to pid-only matching → sweep test fails with `'ended' !== 'working'` / `its wrapper runs` (confirms the sweep now correctly tolerates a wrapper that hasn't written `pid` yet).

All three mutations are caught by the new tests, so the fix and its tests are load-bearing, not cosmetic.

**Command-line match review:** `wrappers()` requires both `args.includes("/wrapper.ts ")` and `" <id> "` found at or after that match's start. Job ids (`ID` regex, `job-state.ts`) never contain spaces, so no substring collision between ids. The decoy pattern `arthur continue <id> "fix .../wrapper.ts"` is excluded because the id token precedes the `/wrapper.ts ` occurrence and the search for `" <id> "` starts only at that occurrence's position. Production always invokes the wrapper via an absolute path (`join(import.meta.dirname, "wrapper.ts")`, `job-scope.ts`), so the leading `/` is guaranteed.

**Checks run myself:**
- `npm ci`: installs cleanly (workspace already had `node_modules`, 7 packages added).
- `npm run check` (tsc): clean, no output.
- `npm test`: 360/360 pass, matches the worker's claim exactly.
- Line budgets: `job-control.ts` 105 lines, `job-records.ts` 156 lines, both under the 200-line cap; the repo's own structure tests (line-budget, no-index/types/utils, boundary tests) all pass in the full run.

**Notes (non-blocking):**
- A pathological case where a user's continue instruction text itself contains `/wrapper.ts` followed later by a `" <id> "` token could in principle be miscounted as a wrapper; this is an inherent limit of command-line text matching, already present in weaker form in the prior code, and not something the ticket asked to close. Worth a one-line limit note if revisited, not a blocker here.
- Worker's final message accurately reflects the diff, the checks, and the three break/fix mutations it describes; I reproduced all three independently.

PASS

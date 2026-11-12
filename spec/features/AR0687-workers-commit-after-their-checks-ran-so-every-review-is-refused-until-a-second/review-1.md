# AR0687 - Review 1

- Job: 2026-11-11-review-d0dc881a
- Branch: arthur/2026-11-11-worker-bd554130
- Commit reviewed: 328c07474d253f63cdcde5d6e0bde17fee433ae2
- Verdict: PASS

## Final message

No finding blocks the merge. The branch meets the ticket's three "Done means" points:

- **Reminder:** `packages/delivery/src/checks-extension.ts:57-59` now names the commit the checks ran on and the current tip, and asks for the scripts again on the committed tip. `packages/delivery/test/checks.test.ts:313-316` pins the full text, so removing the new sentence fails it.
- **Why it never fired:** sandboxed jobs could write their own `<home>/delivery/<id>/checks` but not read it back, so the reminder threw `EACCES`. `packages/core/src/job-sandbox.ts:116` now shows the job's own folder of each extension. These are the same folders `writable()` already grants, worked out from the same record file. I removed that addition by hand and `test/job-home.test.ts` failed in the real sandbox ("its checks in delivery's folder denied", where "read" is expected). Restored with `git checkout -- packages/core/src/job-sandbox.ts`, and the tree is clean.
- **Worker role:** `packages/core/roles/worker.md:17` gets one line on the order. The ticket names `packages/orchestration/roles/worker.md`, which does not exist; the only worker role is `packages/core/roles/worker.md`, and the final message explains the swap.
- **Other changes:** the sandbox change in core is outside the ticket's Scope "In", and the final message explains it: without it the Goal cannot be met. The docs that said the job's own extension folder is hidden (`spawn.md`, `deploy.md`) were updated. I searched for any other line that still says so and found none.
- **Budgets and file sizes:** delivery's line budget goes from 2243 to 2246, which `outcome.md` should show. `job-sandbox.ts` was already yellow and ends one line shorter (215).

Every claim in the worker's final message that I checked matched what I saw. Line 116 also makes the expected `hidden()` merge conflict with `main` real.

## Notes
- (risk) packages/core/src/job-sandbox.ts:116: what is shown is decided by a file the job can write. The record's `extensions` file is in the job's own record. A job that rewrites it before its next run can show `<home>/<any top-level folder>/<its own id>`. `writable()` already grants writes to the same set, so a job reaches nothing new beyond folders named with its own id. Still, it loosens AR0590's rule that the whole home stays hidden, a rule the owner set.
- (minor) packages/delivery/src/checks-extension.ts:57: if the scripts ran on different older commits, the new sentence names only the first. The full list before it names each one.
- (minor) packages/models/test/models.test.ts:285: this file is not in the diff. It failed once in the full `npm test` run, with `ENOENT` on `state.lock`, and passed 20/20 when run alone, so it looks flaky and does not count against the branch.
- (minor) packages/core/src/job-sandbox.ts:116: the merge will conflict with `main`, which also changed `shown` in `hidden()`. Keep both shown entries, as the worker says.

## Checks (at 328c0747)
- `npm run check`: tsc reported no errors.
- `npm test`, first run: 1 failure, in `packages/models/test/models.test.ts`, a file the diff does not touch.
- That file alone (`node --import @arthur/core/testing --test packages/models/test/models.test.ts`): 20 tests, 20 pass, 0 fail.
- `npm test`, second run: 1697 tests, 1633 pass, 0 fail, 64 skipped. The structure test passed with delivery's budget at 2246.
- `npm run mutate`: 23 mutants, 23 caught, 0 survived. That is every mutant of the change, which meets min(25, all).
- Hand mutation: I removed the line that shows the job's own extension folder in `hidden()`. `test/job-home.test.ts` failed in the real sandbox; the file is restored.

PASS
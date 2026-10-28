# AR0470 - Review 3

- Job: 2026-10-28-review-6de81df1
- Branch: arthur/2026-10-27-worker-7ccfb33a
- Commit reviewed: 585b585ab15667af021d81622417194eb28f42d8
- Verdict: PASS

## Final message

No blocking findings. The finding that failed round 2 is fixed: a test now fails when `"-maxdepth", "1"` is removed from the sweep.

## Findings

None.

## Notes (not blocking)

- **Fix for round 2's finding:** `packages/delivery/test/merge.test.ts:175` makes two `cache_x` folders, each two days old and one level below the top. One sits inside the young `cache_Runnin`, the other inside `cache-shop`, a folder named like a project's. The test asserts both still exist after the merge. `aged` sets an inner folder's age before the folder holding it, so the outer folder's age is set after its contents are written and stays as the test sets it.
- **The rename and file size, as in round 2:** the rename from `cache-` to `cache_` goes against the ticket's "`cache-*`" wording. Review 2 accepted it with its reasons: project names (`project-options.ts:14`) and job ids cannot contain `_`. F2 in `findings.md` tracks the old `cache-<random>` folders left behind. `merge-command.ts` is exactly 200 lines, which is the limit.
- **Round 2's notes still hold:** removing `-mindepth 1` has no effect, and moving the sweep to after `lock.release()` is not caught by any test.
- **`find` edge confirmed:** GNU find 4.9.0 matched a folder exactly one day and 30 seconds old with `-mmin +1440`, and did not match one a day minus 30 seconds old. That matches the test's limits.

## Checks run

- **`npm ci`:** 22 packages added.
- **`npm run check`:** exit 0.
- **`npm test`:** 1225 tests, 1164 passed, 0 failed, 0 cancelled, 61 skipped. This matches the worker's numbers.
- **Baseline:** `node --import @arthur/core/testing --test --test-name-pattern="older than a day|a failed check resets main" packages/delivery/test/merge.test.ts` gave 2 passed, 0 failed.
- **Mutations:** each was run against the same two tests and restored with `git checkout -- <file>`. Every one was caught:

| Mutation | Result |
|---|---|
| `-maxdepth 1` removed | 1 failed. Actual `[false,true,true,true,false,false]`, so both inner `cache_x` folders were deleted. |
| `-mmin +1439` | 1 failed |
| `-mmin +1441` | 1 failed |
| name pattern `cache*` | 1 failed |
| the sweep's `find` line deleted | 1 failed |
| the merge's own folder prefix in `merge-command.ts` set back to `cache-` | 2 failed |
| `reinstall`'s prefix in `merge-checks.ts` set back to `cache-` | 1 failed |

- **Clean checkout:** `git status --short` after the restores printed nothing.

PASS
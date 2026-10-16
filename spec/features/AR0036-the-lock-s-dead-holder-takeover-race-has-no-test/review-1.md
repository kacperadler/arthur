# AR0036 - Review 1

- Job: 2026-10-16-review-ar0036-lock-takeo-3acc6161
- Branch: h/2026-10-16-ar0036-lock-takeover-rac-cb936e0d
- Commit reviewed: a9f6900257d5b99fcccf097113c6b8c31892ab17
- Verdict: PASS

## Final message

Worktree clean, no leftover mutations.

Findings: none. The fix correctly closes the identified race (verified by mutation: reverting the recursive `takeOver(guard, …)` to the old blind `rmSync(guard)` reliably fails the stuck-guard race test 3/3 locally, matching the worker's claim). The identity-check mutation (dropping the pid/inode match before deleting) also reliably fails both race tests 3/3, confirming the overlap assertion is load-bearing, not tautological. Recursion is bounded: it only descends when the holder at that level is dead, and a live holder at any depth halts recursion immediately (`return` without creating a deeper file), so there is no livelock or unbounded nesting — contention resolves one level per round via the outer retry loop in `take()`/`withLock`.

Tests match both ticket Done-means points (dead-pid race with no overlap and all finishing; a seeded dead-pid `.takeover` guard recovered by the next taker) and use the existing `temporaryFolder()`/test-kit safety net — no production-named resources, no leaked files (asserted each round), children killed in `finally`. Scope stayed inside the ticket's allowance (`lock.ts` touched only because a test exposed a real bug, as permitted).

Checks run locally:
- `npm ci`: clean, 5 packages added.
- `npm run check`: passes, no tsc errors.
- `npm test`: 97/97 pass.
- `node --test packages/core/test/lock.test.ts` × 10: 6/6 pass every time, no flakiness.
- Mutation A (old blind `rmSync(guard)` restored): 3/3 runs fail the 50-round guard race, matching worker's reported 19-30/20-30 failure claim in kind.
- Mutation B (identity check dropped before `rmSync(path)`): 3/3 runs fail both race tests, confirming the overlap assertion is load-bearing.
- Worktree restored to clean state after each mutation (`git checkout --`, confirmed identical to pre-mutation file and `git status --porcelain` empty).

Notes (non-blocking): none beyond styleguide — both touched files are well under the 200-line budget.

PASS

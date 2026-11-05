# AR0629 - Review 2

- Job: 2026-11-05-review-47474436
- Branch: arthur/2026-11-05-worker-be6656d0
- Commit reviewed: a26fb7b7dae5257972fe486a9f868e37756eddee
- Verdict: FAIL

## Final message

I found one blocking problem: a key branch has no test, so this is a FAIL. Mutating that branch shows the tests still pass without it.

## Findings

1. **`packages/delivery/src/pass-forward.ts:72`: the choice between rerunning a killed merge and waking the coordinator has no test.** The line is `if (code === "" && rerun(started.project)) continue;`. I changed it to `if (code === "" && false) continue;` and the whole of `packages/delivery/test/review.test.ts` still passed (25 pass, 0 fail).
   - **The ticket's own case goes through this line.** A reboot or a killed scope leaves a `merge-runs/<job>-<x>/` folder with no `exit` file and a dead pid. On the next start, `check()` runs before the per-project `rerun` loop.
   - **What goes wrong without it:** the coordinator first gets `killed before its end, it did not go in; act on its last line…`, and only then the rollback and rerun. That is the hand-fix prompt the ticket wants gone ("without the coordinator noticing it by hand").
   - **A second path is untested too:** a merge this `arthur run` watched that dies while `arthur run` keeps running (the docs' "when a merge it watched went without an exit status").
   - **Why no test catches it:** the rollback test seeds only `merge.lock` and `merging`, never a dead run folder. The "outlives" test's killed run makes no merge commit, so `rerun` returns false there either way.
   - **Needed:** a test where a dead run folder sits beside a dead lock and the job's merge commit on HEAD. It should assert one wake, the rerun's, and no "killed before its end".

On the surviving compare-and-swap mutant (`update-ref HEAD <parent>` without the old `<hash>`): I accept it. The old value only matters if a commit lands between the `rev-list` and `update-ref` calls in one synchronous function. With hooks off, no test can put a commit there. The guard costs one argument and keeps the second writer's commit.

Everything else in the Done means is met and tested:
- The merge runs in its own session, plus a systemd scope where one can be made. Mutating `detached: true` to `false` makes the "outlives" test fail.
- The roll back to the first parent keeps the board, removes the lock and reruns.
- A live lock is left alone, and so are the other HEAD shapes listed in the test.
- Git's refusal leaves main where it was and tells the coordinator.
- The line budget raise is the approved AR-D504.
- `merge-recovery.ts` is 47 lines; `pass-forward.ts` is 108.

## Notes
- (risk) `packages/delivery/src/pass-forward.ts:46`: the scope probe reuses one unit name per process. `arthur-merge-probe-<pid>.scope` is the same name for every merge in one `arthur run`. If two merges start close together, the second probe may hit "unit exists", and that merge then runs without a scope, inside `arthur run`'s cgroup.
- (risk) `packages/delivery/src/pass-forward.ts:47`: tests may create real user scopes under the production `arthur-merge-` prefix. This happens wherever a user manager answers; `--collect` removes them, but the name is production's.
- (minor) `packages/delivery/src/merge-recovery.ts:27`: a dead lock with HEAD of another kind leaves `merging` behind. The lock goes but `merging` stays until the next merge overwrites it.
- (minor) `spec/features/AR0629-…/findings.md`: F1 points at `pass-forward.ts:65`; the `alive` check it means is now line 69.

## Checks (on a26fb7b7)
- `npm run check && npm test`: tsc passed. The first run's output filter didn't capture the test counts, so I ran `npm test` again: 1555 tests, 1491 pass, 0 fail, 64 skipped.
- `npm run mutate`: no result. It hit the 1800 s bash timeout and was interrupted. Afterwards no process was left (`pgrep`) and the tree was clean.
- Hand mutation, check-path rerun → `false`: the change survived (review.test.ts 25 pass, 0 fail). Restored with `git checkout`.
- Hand mutation, `detached: true` → `false`: the "outlives" test caught it (0 pass, 1 fail). Restored with `git checkout`; no leftover `merge --auto` process, tree clean.

FAIL
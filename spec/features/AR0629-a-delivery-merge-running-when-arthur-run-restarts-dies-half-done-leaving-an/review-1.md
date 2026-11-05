# AR0629 - Review 1

- Job: 2026-11-05-review-0493daa8
- Branch: arthur/2026-11-05-worker-be6656d0
- Commit reviewed: 56badb4cf61d2b44ecba2567538ae162c3928b8d
- Verdict: FAIL

## Final message

FAIL: no test protects another writer's commit on main from the rollback. Deleting the guard that stops it still passes every test of this branch. The run also left 3 merge processes behind, all started during my `npm run mutate`; I stopped them.

## Findings

1. **`packages/delivery/src/merge-recovery.ts:29` has no test, and it is the guard that keeps a rollback from dropping another writer's commit.** This line is the only check that HEAD is the dead job's own merge commit: exactly two parents, the second being the branch tip. Without it, `recoverMerge` runs `git reset --keep <HEAD's first parent>` on any HEAD sitting under a dead `merge.lock`. That throws away any commit made on top of the dead merge. Two real cases:
   - The coordinator commits on main after the merge died.
   - The merge is killed after its checks passed and after its ticket-side commit (`merge-command.ts:162-165`), but before `github.push`. HEAD is then a one-parent commit and the merge is not yet on any remote, so the remote check does not stop the reset either. The `last-merge` check does not stop it: `last-merge` holds the merge commit, while the code compares it with HEAD, which is now the ticket commit.

   I replaced the line with `void more; void second;`. The 3 new tests (`rolls back|outlives|5 seconds`) all still passed, then I restored the file. The test at `packages/delivery/test/review.test.ts:777` covers a live lock, a recorded `last-merge` and a remote branch. All three have HEAD equal to the merge commit itself; none has a commit on top of it or a HEAD of another shape. This is the merge's main protection for other people's work on main, so the missing test is a FAIL under the review criteria.

## Notes
- (risk) `packages/delivery/test/review.test.ts:723`: a merge started in a test can outlive the test. After my `npm run mutate`, 3 pairs of processes were still running: `sh` plus `node …/cli.ts merge --auto 2026-01-01-worker-*`, under `/tmp/arthur-test-*/…/merge-runs/`. They had started 15 to 22 minutes earlier, during the mutate run, not during the `npm test` that passed. Probably a fake merge waiting on a gate file that a failing test never wrote `[INFERENCE]`. The test has no `t.after` that kills the process group of the merge it started. I stopped the three groups with `kill -TERM -- -<pgid>`, and `ps -p` then listed none of the 6 pids.
- (risk) `packages/delivery/src/merge-recovery.ts:28-32`: HEAD is checked, then reset, without a compare-and-swap. A commit that lands on main between `rev-list` and `reset --keep <parent>` is dropped; only `merge.lock` is held, and other writers don't take it. The window is milliseconds.
- (risk) `packages/delivery/src/merge-recovery.ts:30`: a push counts as pushed only if `refs/remotes` contains the commit. A push whose remote-tracking ref was never updated would be rolled back. On today's order (push only after `locked()` returns, `merge-command.ts:47-48`) this cannot happen for an unchecked merge commit; this is `[INFERENCE]` from reading the code.
- (minor) `packages/delivery/src/pass-forward.ts:66-73`: if only the `sh` wrapper dies and `arthur merge` keeps running, the coordinator is told `killed before its end` while the merge goes on. Nothing is lost, because the live lock stops any rollback.
- (minor) `packages/delivery/test/review.test.ts:723`: the ticket asks for a test that sees the merge "finish and push". The "push" here is a line the fake merge prints, not a real `git push`. The worker says so.

## Checks (on 56badb4c)
- `npm run check && npm test`: tsc passed. 1555 tests: 1491 pass, 0 fail, 64 skipped.
- `npm run mutate`: no result. The 1800 s bash timeout killed it before it printed anything past the header.
- Hand mutation `merge-recovery.ts:29` (the merge-commit shape guard removed): the 3 new tests in `review.test.ts` all passed, so the mutant survived. Restored with `git checkout -- packages/delivery/src/merge-recovery.ts`; `git status --short` printed nothing afterwards.
- Searched `packages`, `spec/roadmap.md` and `README.md` for doc lines still saying the merge runs as a child process: no matches.

FAIL
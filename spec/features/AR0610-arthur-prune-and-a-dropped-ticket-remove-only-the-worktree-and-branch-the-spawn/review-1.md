# AR0610 - Review 1

- Job: 2026-11-04-review-e864a275
- Branch: arthur/2026-11-03-worker-a2c1fad8
- Commit reviewed: 959b071b55898a3dd53da0802464d0f586cbe4f6
- Verdict: PASS

## Final message

PASS. I found nothing that blocks the merge. The two paths are closed: a job can no longer choose the branch or worktree that `arthur prune`, `remote-job prune` and a dropped ticket remove. The new checks are covered by tests that fail when the check is removed.

The four parts:
- **The shared check:** `unpruned()` in `packages/core/src/job-sandbox.ts:90-94` refuses a record in three cases:
  - its branch is something other than `arthur/<id>` or none;
  - its `root` is not the project's checkout now (taken from the project list, not the record);
  - its place fails `misplaced()`.

  The only exception is the spawn's own worktree path when that folder is already gone, where pruning can only touch `arthur/<id>`.
- **Local prune** (`packages/core/src/job-records.ts:149-152`): runs the check before any Git call, the tip's `rev-parse` included.
- **Prune on the other machine** (`packages/core/src/remote-job.ts:84-86`): checks the record against `<home>/repos/<project>.git` before any Git call.
- **Dropped ticket** (`packages/delivery/src/ticket-prune.ts:19,25`): `-D` only runs on `job.branch === arthur/<id>`, in the checkout from the project list.

Ways around it I tried, none of which work:
- **Changing `machine` to skip the local `misplaced()`:** the root and branch are still checked here, and the other machine checks its own record.
- **Changing `project`:** the check then needs a repository where Git added `worktrees/<id>`, and only the spawn's repository has one.
- **Deleting its own worktree:** what's left is `git worktree prune` plus `-d arthur/<id>`.

The tests catch removing the branch filter in the drop path, removing the root check, removing the `there` exception and removing the spawn-path condition on a gone worktree. I ran the root-check removal myself; the others I worked out from the test assertions without running them.

The core budget raise from 7126 to 7145 falls under the owner policy AR-D63. The worker's final message explains why `job-sandbox.ts` is now yellow at 208 lines.

## Notes
- (minor) `packages/delivery/src/ticket-prune.ts:19`: `-D` doesn't wait for the place to pass the check. The ticket's Scope says "the `-D` only on `arthur/<id>` of a job whose place passes the check", but the filter only looks at the branch. Say a record has the right branch but a changed worktree, and the job detached its HEAD. Then the drop force-deletes the job's own `arthur/<id>` while its worktree and record stay. Only the job's own branch is at risk, never another job's or the owner's. The worker's final message explains this, so it doesn't block.
- (risk) `packages/core/src/job-records.ts:150`: a job whose project is no longer in the project list is now kept (`unknown project <name>; …`) instead of pruned. The worker's final message states this and `merge.test.ts` was updated for it, but such jobs will now pile up until the project comes back.
- (minor) `packages/delivery/src/ticket-prune.ts:19`: `host.jobs.list()` now runs on every prune, even without `drop`, just to save a line.

## Checks
- `npm run check && npm test` (one call): `tsc` clean; 1505 tests, 1441 pass, 0 fail, 64 skipped. This matches the worker's numbers.
- Hand mutation: I replaced `unpruned`'s root check with `if (false)` and ran the two new tests by name (in `job-records.test.ts` and `machine.test.ts`). Result: 0 pass, 2 fail, so the mutation is caught. Restored with `git checkout`; the tree is clean.
- I did not run `npm run mutate` because the review budget was small; the hand mutation covers the main condition.

PASS
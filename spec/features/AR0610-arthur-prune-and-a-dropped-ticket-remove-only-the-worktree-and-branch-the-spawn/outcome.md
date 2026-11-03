# AR0610 - Outcome

- Merged: 2026-11-04, `e3deefdc`
- Branch: arthur/2026-11-03-worker-a2c1fad8
- Reviews: review-1.md PASS
- Cost: worker $3.40, reviews $0.45; review rounds 1

## What went in

- packages/core/src/job-sandbox.ts: `unpruned()` says why a prune may touch none of a record: a branch other than `arthur/<id>` or none, a checkout other than the project's checkout now, or, on this machine, a place `misplaced()` refuses (a spawn's worktree already gone needs only its path).
- packages/core/src/job-records.ts: `jobUpkeep` takes `checkout(project)`; `prune` runs `unpruned` before any Git call and keeps worktree, branch and record with the reason.
- packages/core/src/jobs.ts: passes `where(project).root` as the checkout to check against.
- packages/core/src/remote-job.ts: `remote-job prune` refuses a record there that `unpruned` refuses, against `<home>/repos/<project>.git`.
- packages/delivery/src/ticket-prune.ts: a dropped ticket force-deletes only `arthur/<id>` of an ended local job whose record names that branch.
- packages/core/test/job-records.test.ts: local prune keeps everything for a changed branch, worktree (another job's, or a path Git never added) and root (worktree present and gone), then prunes once restored.
- packages/core/test/machine.test.ts: the prune on another machine keeps everything for a changed branch or worktree there and a changed root here, then prunes once restored.
- packages/delivery/test/merge.test.ts: a dropped ticket's job whose record names another job's branch deletes no branch and says why; a project gone from the list keeps its job.
- packages/github/test/github-branch.test.ts: fixture worktrees sit in `.arthur-worktrees` beside the checkout, as a spawn puts them.
- packages/manage/test/cleanup.test.ts: project `acme` provided to the fake host; records name the spawn's worktree path.
- packages/core/docs/commands/prune.md: documents the spawn-place check and its messages.
- packages/core/docs/commands/remote-job.md: `prune` refuses a record there whose place or branch was changed.
- packages/delivery/docs/delivery.md: a drop's `git branch -D` only on `arthur/<id>`.
- test/structure.test.ts: core line budget 7126 → 7145.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1434/1505 passed.

## Left open

- Deferred (client summary): F1. a job whose project is no longer in the project list is now kept (`unknown project <name>; …`) instead of pruned

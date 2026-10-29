# AR0555 - Outcome

- Merged: 2026-10-29, `21bdc5ff`
- Branch: arthur/2026-10-29-worker-b17e611d
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS
- Cost: worker $26.52, reviews $4.24; review rounds 4

## What went in

- `packages/github/src/github.ts`: answers the core's prune hook (`jobs.keep`), never keeping a record; in the background, one job at a time, deletes a pruned job's `arthur/<id>` branch on origin when origin's tip is the commit it pushed (kept in `.arthur/github/pushed/<id>`, written only on a push that went out) or one main holds; a refusal is a notice, never a kept worktree.
- `packages/github/src/github-git.ts` (new): origin's branch list and the leased, no-prompt delete with the config refusal, shared with AR0560.
- `packages/github/src/github-branch.ts`, `github-command.ts`: `arthur github branch sweep [--dry-run]` deletes `arthur/*` branches on origin whose job is gone and whose tip main holds, lists each kept one with its reason, exit 1 on a refused delete, refused inside a job.
- `packages/delivery/src/ticket-prune.ts` (new), `merge-command.ts`, `delivery.ts`: a merge prunes every ended job of its ticket and a drop does too, deleting their unmerged branches; only the ticket's own jobs (`<id>-` match); both end the ticket's hand-backs; a job of a dropped ticket that ends later is pruned after the wake read it; a dropped ticket's review wakes the coordinator with one true line.
- `packages/delivery/src/hand-back.ts`: a review of a dropped ticket is neither filed nor handed back.
- `packages/core/src/wrapper.ts`: omp keeps each job's sessions in its record (`--session-dir <record>/session`), so a prune removes them.
- Docs: `github.md`, `github-branch.md` (new), `merge.md`, `review.md`, `delivery.md`, `after-merge.md`, `spawn.md`, `plugin-api.md`, the example config; evals of merge, review-pass and the session; `test/structure.test.ts`: github 870 -> 951 (AR-D335), delivery 1686 -> 1734 (AR-D335, AR-D338, AR-D342).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1241/1309 passed.

## Left open

- Deferred (client summary): F2. A blocked review of a dropped ticket gets a wake saying delivery prunes it, but it is kept.

# AR0570 - Outcome

- Merged: 2026-10-30, `5a2e3ed8`
- Branch: arthur/2026-10-30-worker-0bc169b2
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $5.19, reviews $2.10; review rounds 2

## What went in

- `packages/core/src/worktree-guard.ts`: a job's write to any `spec/features/*/ticket.md` in its worktree is refused, saying what to do instead; `findings.md` stays writable.
- `packages/orchestration/src/paper-check.ts` (new), `packages/orchestration/src/orchestration.ts`: orchestration provides `merge.check`, which refuses a worker branch whose merge would change a `ticket.md`, `spec/decisions.jsonl` or `spec/build.json`, naming the file; it diffs main against the tree `git merge-tree --write-tree` would make, so every merge base counts, and reads the tree from merge-tree's output, not its exit code.
- `packages/delivery/src/review-needed.ts`: asks `merge.check` first, so no review is paid for a branch the merge would refuse.
- `docs/plugin-api.md`, `packages/core/docs/commands/spawn.md`, `packages/delivery/docs/commands/merge.md`, `packages/delivery/docs/commands/review-needed.md`: say the above.
- `packages/core/test/worktree-guard.test.ts`, `packages/orchestration/test/paper-check.test.ts` (new), `packages/delivery/test/review-needed.test.ts`: tests of each, two and three merge bases included.
- `test/structure.test.ts`: line budgets core 6476 to 6478, delivery 1737 to 1740, orchestration 2434 to 2463 (AR-D355).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1279/1347 passed.

## Left open

- Deferred (client summary): F1. `arthur review` and the hand-back start a paid review of a branch merge.check refuses
- Deferred (client summary): F2. The coordinator's procedure tells the owner about a merge.check refusal the worker can fix itself
- Deferred (client summary): F3. Many shell routes write a ticket.md past the guard; merge.check stops them on the branch.
- Deferred (client summary): F4. On a case-insensitive file system, Ticket.md passes the guard and the check and reaches the real ticket.
- Deferred (client summary): F5. merge.check reads the job's branch again after CI, so a branch that moves mid-merge is judged at another commit.
- Deferred (client summary): F6. A symlinked ticket folder passes and counts toward the next ticket id.
- Deferred (client summary): F7. merge.check writes unreferenced trees and blobs into the object store on every run.
- Deferred (client summary): F8. The commit subjects have no AR0570 scope.

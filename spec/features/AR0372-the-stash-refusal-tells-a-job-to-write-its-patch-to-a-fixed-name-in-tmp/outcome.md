# AR0372 - Outcome

- Merged: 2026-10-25, `4fbe9a47`
- Branch: arthur/2026-10-25-worker-eee3020e
- Reviews: review-1.md PASS
- Cost: worker $0.28, reviews n/a; review rounds 1

## What went in

- `packages/core/src/worktree-guard.ts:31`: the `git stash` refusal tells a job to save a patch in its own worktree (`git diff > .arthur-stash.patch`, then `git apply .arthur-stash.patch`), not a fixed name in `/tmp` another job could plant; one line changed in place, the core's line budget holds.
- `packages/core/test/worktree-guard.test.ts`: the stash rows match only the exact refusal text, and an allowed row shows the guard passes the new advice.
- Review PASS (review-1.md). Merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1106/1106 passed.

## Left open

- Findings: none; no findings.md on this ticket.

- Tickets from findings: AR0414 (F1).

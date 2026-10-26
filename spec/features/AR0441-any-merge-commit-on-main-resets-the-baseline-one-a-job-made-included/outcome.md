# AR0441 - Outcome

- Merged: 2026-10-26, `c661a81d`
- Branch: arthur/2026-10-26-worker-3b5515b3
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $5.85, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/merge-command.ts`: the stray-commit check lists code commits on main's first-parent line since the last merge `arthur merge` made, read from `.arthur/delivery/<project>/last-merge` (written after each merge's checks pass, temporary name then rename), merges included, so a job's own merge commit no longer resets it. A record off the first-parent line, or one main no longer holds, refuses the merge naming the commit, and `arthur take-main` lifts it; a missing or unreadable record falls back to main's last merge commit as before.
- `packages/delivery/src/take-main.ts`, `delivery.ts`: `arthur take-main [--decision <id>] [--project <name>]` records main as it is, on the owner's recorded `merge` decision; refused in a job.
- Docs: `docs/commands/merge.md`, the new `docs/commands/take-main.md`, a paragraph in orchestration's `decision.md`.
- Tests: `packages/delivery/test/merge.test.ts` (a job's own merge commit, main reset below the record, an unknown hash, take-main lifting it, a refused merge writing nothing). Delivery line budget 1434 (AR-D66, AR-D70).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1163/1169 passed.

## Left open

- F1: fixed in 07d4ed9f (AR-D67). F2 to F4: dropped (see findings.md); AR0452 dropped.

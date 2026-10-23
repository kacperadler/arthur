# AR0314 - Outcome

- Merged: 2026-10-23, `eb0ddc5`
- Branch: h/2026-10-23-ar0314-79966166
- Reviews: none
- Cost: worker $1.05, reviews $0.00; review rounds 0

## What went in

- `packages/delivery/src/ci-wait.ts`: the wake after a failed CI run on a waiting branch ends with both moves: a failure in the branch's own code goes back to its worker with `arthur continue`, a transient one is rerun once; `packages/delivery/test/auto-merge.test.ts` pins the whole line and `merge.md` describes it.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1048/1048 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/39951691597

## Left open

- Tickets from findings: AR0315 (F1).

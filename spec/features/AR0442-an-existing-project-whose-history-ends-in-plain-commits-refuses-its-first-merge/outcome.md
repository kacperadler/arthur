# AR0442 - Outcome

- Merged: 2026-10-26, `8234e81f`
- Branch: arthur/2026-10-26-worker-d2f7d94d
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.36, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/merge-command.ts`: the stray-commit refusal names the newest 10 code commits, then `and <k> more`, and ends like the other baseline refusals: the owner decides, and `arthur take-main` lifts it. Delivery line budget 1436 (AR-D78).
- `packages/projects/roles/coordinator/onboarding-ended.md`, `packages/projects/docs/commands/init.md`, `packages/delivery/docs/commands/merge.md`: before an onboarding's merge on a main with no merge `arthur merge` made, the coordinator asks the owner for `arthur take-main` (the decision, the take, then the merge).
- Tests: `packages/delivery/test/merge.test.ts` (12, 11 and 10 stray commits; take-main lets the merge in), `test/onboarding-merge.test.ts` (a project whose code came in a plain commit: refused, then merged after the take).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1165/1171 passed.

## Left open

- Nothing.

# AR0431 - Outcome

- Merged: 2026-10-26, `7c8205b5`
- Branch: arthur/2026-10-26-worker-ccfd2e9b
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.59, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/delivery.ts`: `beforeSpawn` passes the spawn's project to `refusal`, which accepts a review only when its project is the project of the worker record its branch names and its task is what `arthur review` builds; otherwise the same refusal as before.
- `packages/delivery/docs/commands/review.md`: the worker's-project rule.
- `packages/delivery/test/review.test.ts`: a second project with a job of its own; the exact task spawned there is refused with no job record left; the same task in the worker's project starts.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1139/1145 passed.

## Left open

- Findings: none; no findings.md on this ticket.

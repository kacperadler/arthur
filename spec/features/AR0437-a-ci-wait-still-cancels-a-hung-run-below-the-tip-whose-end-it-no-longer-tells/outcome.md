# AR0437 - Outcome

- Merged: 2026-10-29, `91c8a24b`
- Branch: arthur/2026-10-29-worker-9f0f2fde
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $1.59, reviews $0.98; review rounds 2

## What went in

- A CI run delivery cancels after it hung 30 minutes on the branch's own commits now wakes the coordinator with `cancelled by delivery after it ran 30 minutes`, even when it is below the tip; `arthur merge --auto` counts a run only when its commit is the tip it read. The delivery line budget went to 1636 (AR-D291).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1207/1275 passed.

## Left open

- Deferred (client summary): F1. A plain merge refuses a passed run below the tip on the branch's own commits, and leaves a CI wait
- Deferred (client summary): F2. A run delivery cancelled below the tip that still ends `success` is told as the pass the wait waited for

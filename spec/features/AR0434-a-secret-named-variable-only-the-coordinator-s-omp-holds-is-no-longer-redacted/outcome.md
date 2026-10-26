# AR0434 - Outcome

- Merged: 2026-10-26, `a63bd50d`
- Branch: arthur/2026-10-26-worker-8b07846f
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.78, reviews n/a; review rounds 2

## What went in

- `packages/orchestration/src/coordinator.ts`: before it starts the coordinator, `own()` removes from the tmux server's global environment every name `arthur run` does not hold, and passes `arthur run`'s value with `-e` for each name the server holds with another value, so the coordinator's omp gets only `arthur run`'s environment, not a stale server's. `pane()` checks the session name, so another session on the same server is never taken for the coordinator's.
- `packages/orchestration/test/coordinator.test.ts`: a coordinator started beside another session on a server holding a stale variable gets neither the stale name nor the stale value.
- `packages/orchestration/docs/commands/coordinator.md`: the start's steps say both.
- `test/structure.test.ts`: orchestration's line budget is 2413 (AR-D104).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1115/1182 passed.

## Left open

- Tickets from findings: AR0465 (F1: a value given again sits in the tmux client's argv for milliseconds).
- F2 to F5, the reviews' notes, dropped (findings.md).

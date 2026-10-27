# AR0464 - Outcome

- Merged: 2026-10-27, `93da6344`
- Branch: arthur/2026-10-27-worker-296532a2
- Reviews: review-1.md PASS
- Cost: worker $1.14, reviews n/a; review rounds 1

## What went in

- `packages/core/test/job-control.test.ts`: the test "arthur stop once the install exited, while a process it forked still holds its output…" forks `sleep 300` instead of `sleep 3`, so only the stop can end it, and waits up to 20 s until that process is gone instead of checking once right after the stop. A killed process not yet reaped no longer fails it; a stop that never reaches the process still does. 20 runs in a row on the host passed. The stop itself is unchanged.
- `findings.md`: F1, the wrapper race behind the flakiness.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1133/1200 passed.

## Left open

- Tickets from findings: AR0481 (F1).
- 20 runs in a row inside a merge step (a Done means line) were not run; the merge's own `npm test` passed once.
- Review notes F2 dropped (findings.md).

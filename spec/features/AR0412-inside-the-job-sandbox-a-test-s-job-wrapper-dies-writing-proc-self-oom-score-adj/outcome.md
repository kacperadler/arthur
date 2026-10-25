# AR0412 - Outcome

- Merged: 2026-10-25, `c07f6da5`
- Branch: arthur/2026-10-25-worker-946b8419
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $0.98, reviews n/a; review rounds 2

## What went in

- `packages/core/src/job-memory.ts`: `oomFirst(start, file)` skips raising `oom_score_adj` to 1000 when the write is refused (EACCES or EPERM), so a job's wrapper inside another job's sandbox starts its agent; where it can write it still raises the score for `start` and restores it, and any other error still throws. Kept within the core's line budget (6156).
- `packages/core/test/scope.test.ts`: a test of the raise and restore, of a refused write (the real file inside a sandbox, a read-only one elsewhere) and of another error (`EFBIG` under `ulimit -f 0`); the no-user-manager test checks only the spawned job's own scope, so it passes inside a job.
- Reviews: review-1 PASS; the merge's `npm test` then failed the core's line budget (6164 over 6156) and main stayed as it was; the worker shortened `oomFirst`; review-2 PASS. Pre-approved by autopilot; merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1106/1106 passed.

## Left open

- Findings: F1-F3 dropped (findings.md).

- Findings: none; no findings.md on this ticket.

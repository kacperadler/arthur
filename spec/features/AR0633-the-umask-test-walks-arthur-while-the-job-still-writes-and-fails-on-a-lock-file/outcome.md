# AR0633 - Outcome

- Merged: 2026-11-09, `98e56bc7`
- Branch: arthur/2026-11-09-worker-4c11a223
- Reviews: none
- Cost: worker $0.86, reviews $0.00; review rounds 0

## What went in

- packages/core/test/umask.test.ts: after `job-ended`, waits until the job's wrapper process (the pid in its record) has ended, then walks `.arthur` and the worktree for modes. A lock the wrapper releases after logging `job-ended` can no longer vanish between listing and `lstat`, and a file left at 644 still fails the test.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1597/1668 passed.

## Left open

- Findings: none; no findings.md on this ticket.

# AR0660 - Outcome

- Merged: 2026-11-09, `cc9e82ee`
- Branch: arthur/2026-11-09-worker-4d0ffef5
- Reviews: none
- Cost: worker $0.78, reviews $0.00; review rounds 0

## What went in

- packages/core/test/model.test.ts: checks a job's folder for the secret with `holding`, which skips a file gone between the list and its read; both secret checks use it.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1599/1670 passed.

## Left open

- Findings: none; no findings.md on this ticket.

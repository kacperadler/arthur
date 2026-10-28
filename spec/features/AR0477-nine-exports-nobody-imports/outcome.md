# AR0477 - Outcome

- Merged: 2026-10-28, `392ae9be`
- Branch: arthur/2026-10-27-worker-e0a93fb6
- Reviews: review-1.md PASS
- Cost: worker $0.99, reviews $0.42; review rounds 1

## What went in

- Nine names that only their own file uses are no longer exported (one line each in nine files); no behaviour changes.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1157/1224 passed.

## Left open

- Findings: F1 dropped (see findings.md).

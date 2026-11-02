# AR0594 - Outcome

- Merged: 2026-11-01, `b9308c3e`
- Branch: arthur/2026-11-01-worker-c732fc82
- Reviews: review-1.md PASS
- Cost: worker $0.29, reviews $0.13; review rounds 1

## What went in

- packages/core/roles/worker.md: the "Try each invariant" bullet now also tells a worker handed back a FAIL review to fix each finding's cause rather than only its example, try the other members of that class it can name, add a test row for each, and answer every finding by number with its fix and pinning test, or the Decision or ticket that leaves it open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1387/1456 passed.

## Left open

- Findings: none; no findings.md on this ticket.

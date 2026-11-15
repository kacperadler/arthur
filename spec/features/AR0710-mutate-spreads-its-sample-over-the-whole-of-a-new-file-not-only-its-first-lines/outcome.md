# AR0710 - Outcome

- Merged: 2026-11-13, `0812b4e6`
- Branch: arthur/2026-11-13-worker-e4aa0cd0
- Reviews: none
- Cost: worker $0.69, reviews $0.00; review rounds 0

## What went in

- test/mutate.ts: takes each hunk's line mutants in an order set by a SHA-1 of their line and text, after the hunk's revert to the base, so a capped run's share of a new file spreads over all its lines, the same on every run.
- test/mutate.test.ts: a test that a capped run over a new 45-line file takes its revert first, then mutants from both its first and last third, and prints the same output when run twice.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1758/1829 passed.

## Left open

- Findings: none; no findings.md on this ticket.

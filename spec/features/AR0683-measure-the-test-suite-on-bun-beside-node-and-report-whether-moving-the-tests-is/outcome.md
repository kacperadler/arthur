# AR0683 - Outcome

- Merged: 2026-11-17, `fc066902`
- Branch: arthur/2026-11-17-worker-1fa279f7
- Reviews: none
- Cost: worker $2.78, reviews $0.00; review rounds 0

## What went in

- `spec/features/AR0683-measure-the-test-suite-on-bun-beside-node-and-report-whether-moving-the-tests-is/report.md`: the Node and Bun times with load, pass/fail counts, failure causes with one example each, the cost of each option, and the recommendation to stay on Node.
- `spec/features/AR0683-measure-the-test-suite-on-bun-beside-node-and-report-whether-moving-the-tests-is/findings.md`: F1, `npm test` likely runs about 10 files at once on a job's 3 CPUs, for AR0671.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1814/1885 passed.

## Left open

- Deferred (client summary): F1. npm test runs about 10 files at once on a job's 3 cores

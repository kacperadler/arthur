# AR0488 - Outcome

- Merged: 2026-10-28, `61c66613`
- Branch: arthur/2026-10-28-worker-a42d9055
- Reviews: review-1.md PASS
- Cost: worker $3.45, reviews $0.84; review rounds 1

## What went in

- `arthur health`'s git calls in a main checkout (its commits and board checks) run with fsmonitor, hooks and replacements off, and first refuse a checkout whose config may name a program, so a health round can no longer start a program a branch planted; a missing project folder now gives the same refusal line. The manage budget went from 928 to 931 (AR-D274).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1192/1260 passed.

## Left open

- Findings: F1 deferred (client summary): a reviewer's `pkill -n -f "npm test"` may stop another job's test run; F2 dropped (notes the code already answers).

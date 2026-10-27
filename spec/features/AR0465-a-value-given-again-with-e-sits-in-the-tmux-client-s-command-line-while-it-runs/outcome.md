# AR0465 - Outcome

- Merged: 2026-10-27, `4318b911`
- Branch: arthur/2026-10-27-worker-1209ec59
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.42, reviews n/a; review rounds 2

## What went in

- fix(AR0465): a value given again to a stale tmux server is in no argv
- test(AR0465): a failed coordinator start restores update-environment

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1135/1202 passed.

## Left open

- Findings: none; no findings.md on this ticket.

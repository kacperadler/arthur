# AR0326 - Outcome

- Merged: 2026-10-23, `77c97ec`
- Branch: h/2026-10-23-ar0326-security-check-b12a34be
- Reviews: none
- Cost: worker $7.62, reviews $0.00; review rounds 0

## What went in

- `spec/features/AR0326-…/check.md`: the checklist of addresses Arthur fetches, 29 rules with where each is enforced, its test and verdict.
- `findings.md`: 4 low gaps, each now a fix ticket AR0366 to AR0369. No code changed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1051/1051 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/39973358515

## Left open

- Tickets from findings: AR0366 (F1), AR0367 (F2), AR0368 (F3), AR0369 (F4).

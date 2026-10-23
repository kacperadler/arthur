# AR0327 - Outcome

- Merged: 2026-10-23, `45bdc3b`
- Branch: h/2026-10-23-ar0327-security-check-56de526b
- Reviews: none
- Cost: worker $6.69, reviews $0.00; review rounds 0

## What went in

- `spec/features/AR0327-…/check.md`: the file-mode checklist of the home, records, sockets and locks, 15 rules with where each is enforced, its test and verdict.
- `findings.md`: 3 gaps (1 high, 2 low), each now a fix ticket AR0370 to AR0372. No code changed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1051/1051 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/39973523382

## Left open

- Tickets from findings: AR0370 (F1), AR0371 (F2), AR0372 (F3).

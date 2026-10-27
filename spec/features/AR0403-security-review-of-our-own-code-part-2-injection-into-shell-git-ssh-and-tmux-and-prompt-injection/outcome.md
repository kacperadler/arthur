# AR0403 - Outcome

- Merged: 2026-10-27, `dae98db4`
- Branch: arthur/2026-10-27-worker-999ff80a
- Reviews: none
- Cost: worker $7.62, reviews $0.00; review rounds 0

## What went in

- `spec/features/AR0403-…/security-review.md`: the review of injection into shell, git, ssh and tmux, and prompt injection: the state of AR0311's findings on main (F4 and F12 fixed, F6 half fixed) and what was checked.
- `spec/features/AR0403-…/findings.md`: 8 new findings, F1 and F2 high, F3 to F5 medium, F6 to F8 low.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1133/1200 passed.

## Left open

- Tickets from findings: AR0482 (F1), AR0483 (F2), AR0484 (F3), AR0485 (F4), AR0486 (F5), AR0487 (F6), AR0488 (F7), AR0489 (F8).
- AR0482 (F1) and AR0483 (F2) are plans: how to close them is the owner's choice.

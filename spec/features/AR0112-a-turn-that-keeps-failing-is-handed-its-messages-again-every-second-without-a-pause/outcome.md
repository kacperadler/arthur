# AR0112 - Outcome

- Merged: 2026-10-18, `c1f0e3d`
- Branch: h/2026-10-18-ar0112-redelivery-backof-852933a6
- Reviews: review-1.md PASS
- Cost: worker $2.46, reviews $0.96; review rounds 1

## What went in

- `packages/orchestration/src/inbox-extension.ts`: after a failed turn its messages go again at once, then after 5 s doubling to at most 5 min; one notice on the third failure in a row; a new owner message ends the wait (owner, 2026-10-18); a reply resets it.
- `packages/orchestration/test/inbox.test.ts`: the gaps, the single notice, the reset, and an owner message ending the wait, in real time.
- `packages/orchestration/docs/commands/coordinator.md`: the wait described.
- `test/structure.test.ts`: orchestration line budget 690 to 697 (Decision).

## Checks on main

- `npm run check`: passed.
- `npm test`: 389/389 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none open; no ticket made.

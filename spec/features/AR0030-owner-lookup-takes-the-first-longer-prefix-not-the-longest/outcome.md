# AR0030 - Outcome

- Merged: 2026-10-16, `6ec64d6`
- Branch: h/2026-10-16-ar0030-longest-prefix-ow-d705af4f
- Reviews: review-1.md PASS
- Cost: worker $0.38, reviews $0.17; review rounds 1

## What went in

- `packages/core/src/env.ts`: `nameProblem` attributes a name to the owner with the longest matching prefix, whatever the declaration order.
- `packages/core/test/env.test.ts`: two three-level setups, each in both orders.

## Checks on main

- `npm run check`: passed.
- `npm test`: 48/48 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

# AR0230 - Outcome

- Merged: 2026-10-20, `7b930a4`
- Branch: h/2026-10-20-ar0230-two-stale-comment-bddae7b8
- Reviews: none
- Cost: worker $0.00, reviews $0.00; review rounds 0

## What went in

- `packages/core/src/wrapper.ts`: the comment says a held job stays `blocked` until its run ends.
- `test/structure.test.ts`: the AR0228 budget comment counts `machineLimit` as -2, so its items sum to the +16 raise.

## Checks on main

- `npm run check`: passed.
- `npm test`: 778/778 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

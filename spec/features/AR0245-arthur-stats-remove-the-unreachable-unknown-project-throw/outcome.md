# AR0245 - Outcome

- Merged: 2026-10-21, `4116eec`
- Branch: h/2026-10-21-ar0245-stats-dead-code-3dccbf4a
- Reviews: none
- Cost: worker $0.77, reviews $0.00; review rounds 0

## What went in

- `arthur stats` loses its unreachable unknown-project throw (the board already refuses an unknown project); the lookup and the empty-board line stay, as both are used. Manage budget 368.

## Checks on main

- `npm run check`: passed.
- `npm test`: 862/862 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

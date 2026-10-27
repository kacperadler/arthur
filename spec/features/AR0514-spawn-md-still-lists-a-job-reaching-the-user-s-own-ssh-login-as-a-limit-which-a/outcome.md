# AR0514 - Outcome

- Merged: 2026-10-27, `de720e86`
- Branch: arthur/2026-10-27-worker-b78bd08d
- Reviews: none
- Cost: worker $0.81, reviews $0.00; review rounds 0

## What went in

- `packages/core/docs/commands/spawn.md`: the sandbox's limits say the keys in `~/.ssh` are hidden from a job (AR0508), and that a password or another stored credential it can read still reaches the user's own SSH login, which is then outside the sandbox.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1156/1223 passed.

## Left open

- Findings: none; no findings.md on this ticket.

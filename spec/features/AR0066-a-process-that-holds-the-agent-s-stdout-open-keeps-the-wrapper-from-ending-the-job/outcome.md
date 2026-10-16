# AR0066 - Outcome

- Merged: 2026-10-16, `7e88ef3`
- Branch: h/2026-10-16-ar0066-held-pipe-does-no-3de234b5
- Reviews: none
- Cost: worker $0.58, reviews n/a; review rounds 0

## What went in

- `packages/core/src/wrapper.ts`: 2 s after the agent exits, pipes still held open are closed, the scope ends (the holder killed), and the job's final files and `state` are written. Core line budget 4226.

## Checks on main

- `npm run check`: passed.
- `npm test`: 259/259 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

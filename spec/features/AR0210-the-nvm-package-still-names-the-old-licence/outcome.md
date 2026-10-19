# AR0210 - Outcome

- Merged: 2026-10-19, `e9e6d98`
- Branch: h/2026-10-19-ar0210-nvm-licence-b98cee71
- Reviews: none
- Cost: worker n/a, reviews $0.00; review rounds 0

## What went in

- `packages/nvm/package.json` says `Apache-2.0` like every other package.
- The structure test refuses any other licence value in the root and every package manifest, so a new package cannot drift.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 696/696 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

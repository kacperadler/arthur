# AR0065 - Outcome

- Merged: 2026-10-16, `cd2bde1`
- Branch: h/2026-10-16-ar0065-continue-runs-bef-39824cd9
- Reviews: review-1.md PASS
- Cost: worker $1.96, reviews $0.81; review rounds 1

## What went in

- `jobs.ts`, `job-control.ts`: `arthur continue` runs the same `beforeSpawn` checks as a spawn, after its own refusals and before it writes anything; a refusal prints the plugin's line, exits 1, starts nothing. Core line budget 4234.

## Checks on main

- `npm run check`: passed.
- `npm test`: 260/260 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0068 (F1).

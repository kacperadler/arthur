# AR0244 - Outcome

- Merged: 2026-10-21, `0baba9d`
- Branch: h/2026-10-20-ar0244-roadmap-61-stats-fb19af34
- Reviews: review-1.md PASS
- Cost: worker $3.03, reviews $1.03; review rounds 1

## What went in

- `packages/manage/src/stats.ts` (new) and `manage.ts`: `arthur stats [--project <name>]` prints, per merged ticket, its review rounds and verdicts, cost (from `outcome.md`, unknown when missing, never 0), days, and autopilot; then the mean rounds, the first-round PASS share, the autopilot share, the 3 most expensive and the first line of each FAIL finding.
- Docs, README, `arthur.mmd`, `test/structure.test.ts` (manage 369).

## Checks on main

- `npm run check`: passed.
- `npm test`: 862/862 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- AR0245: arthur stats: remove the unreachable unknown-project throw

- Findings: none; no findings.md on this ticket.

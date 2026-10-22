# AR0290 - Outcome

- Merged: 2026-10-22, `4b8b178`
- Branch: h/2026-10-22-ar0290-1ab1dbc4
- Reviews: review-1.md PASS
- Cost: worker $0.87, reviews $0.69; review rounds 1

## What went in

- `packages/telegram/test/commands.test.ts`: each start waits until `menu.json` holds the commands it expects for each bot (`holds`) before `stop()`, so stopping never cancels a menu call still waiting for its answer; the plugin is unchanged.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1029/1029 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

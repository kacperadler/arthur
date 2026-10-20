# AR0227 - Outcome

- Merged: 2026-10-20, `4cf42d3`
- Branch: h/2026-10-20-ar0227-uptime-plugin-f319c5fb
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $7.01, reviews $1.31; review rounds 2

## What went in

- `packages/uptime/`: the new uptime plugin: its option table (`sites` per project, `everySeconds`), one HTTP check per site with the reason of each failure, the down state kept in `.arthur/uptime/state.json` across a restart, and a site down after 2 failed checks in a row, with one notice and an `uptime-down` event, one more with `uptime-up` when it is back, and this machine offline told apart from a site down; its doc `docs/uptime.md` and tests.
- `spec/roadmap.md`: entry 98, and why it was built early; `spec/vision.md`: uptime in the plugin table; README, `arthur.mmd`, `arthur.config.example.ts`: uptime shown and configured; `test/structure.test.ts`: uptime budget 288.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 793/793 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0232 (F1); AR0233 (F2) dropped.

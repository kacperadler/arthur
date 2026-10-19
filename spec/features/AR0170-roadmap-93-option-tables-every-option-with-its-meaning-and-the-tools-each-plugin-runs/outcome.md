# AR0170 - Outcome

- Merged: 2026-10-19, `8032932`
- Branch: h/2026-10-19-ar0170-74fefb69
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $13.98, reviews $1.85; review rounds 2

## What went in

- Every option of the core, orchestration and projects is an entry of one table, `{ about, check }` or `{ about, fields }`, whose `about` is its meaning in one line; each plugin's own option check walks that table, so an option without its meaning cannot exist.
- The table's type and walker are published by `@arthur/core`; each package exports its table, `summary` and the tools it runs, for `arthur setup` (94).

## Checks on main

- `npm run check`: passed.
- `npm test`: 570/570 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0177 (F1), AR0178 (F2).

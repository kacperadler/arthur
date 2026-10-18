# AR0141 - Outcome

- Merged: 2026-10-18, `2376bf5`
- Branch: h/2026-10-18-ar0141-99f8f735
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $9.57, reviews $1.78; review rounds 2

## What went in

- `packages/resources/src/feature-caps.ts`, `feature-guard.ts`, `resources.ts`: `perFeature` caps (`budgetUsd`, `hours`, `cpu`, `memory`) over all jobs of one ticket; a ticket's `"caps"` replace them key by key, 0 = no cap; a spawn or `arthur continue` at a money or time cap is refused naming spend and cap; a background check stops every job of a ticket that crosses a cap (exactly at the cap stops, one cent below does not), which ends `blocked` on `user: feature cap ...`; `arthur resources <ticket>` shows spend against caps.
- Core: each ticket gets its own slice for CPU and memory; a `ran` time file per job; `cost`, `budget`, `seconds` in `host.jobs.list()`; a `stop` option on `host.jobs.block`; a new job starts with `cost` 0 and a missing cost file counts as the whole budget. Budgets core 4786, resources 231.
- Docs (`resources.md`, `commands/resources.md`, `jobs.md`, `spawn.md`), `arthur.config.example.ts`, README, `arthur.mmd`: entry 33 built.

## Checks on main

- `npm run check`: passed.
- `npm test`: 465/465 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0145 (F1), AR0146 (F2), AR0147 (F3).

# AR0247 - Outcome

- Merged: 2026-10-21, `42cfa5b`
- Branch: h/2026-10-21-ar0247-roadmap-55-hand-b-835027a0
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $12.51, reviews $2.03; review rounds 2

## What went in

- `packages/delivery/src/hand-back.ts`: while `arthur run` runs, a FAIL review is filed, its worker continued with the findings and its budget again, and the next review spawned when the worker ends; `/stopall` cancels it, a spawn refused at `maxAgents` is retried when a slot frees, the second FAIL stops at the review limit. State survives a restart; FAIL ends replayed at start are acted on once.
- New host member `host.jobs.continue(id, instruction, budgetUsd?)` through `beforeSpawn`, recorded in `docs/plugin-api.md`; the test kit's `FakeHost.continue` goes.
- A stopped review's wake no longer says "review again". Docs, coordinator role, README, `arthur.mmd`, budgets.

## Checks on main

- `npm run check`: passed.
- `npm test`: 876/876 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0251 (F1).

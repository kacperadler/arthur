# AR0277 - Outcome

- Merged: 2026-10-22, `c4047e0`
- Branch: h/2026-10-22-ar0277-eval-turn-wording-9459b77a
- Reviews: review-1.md PASS, review-2.md PASS, review-3.md PASS
- Cost: worker $7.14, reviews $2.31; review rounds 3

## What went in

- `packages/develop/src/eval-scenario.ts`: an eval builds a scenario's message, job-end and plugin turns by asking orchestration's `coordinator.turn`, instead of its own copy of the wake and inbox lines.
- `packages/orchestration/src/inbox.ts`: `coordinator.turn` answers with the exact text the coordinator receives for each turn kind.
- `packages/develop/test/eval.test.ts`, `scenarios.test.ts`: assert the payload each kind asks for; the 19 scenarios of entry 68 run through it.
- `packages/develop/docs/commands/eval.md`, `test/structure.test.ts`: the four turn kinds documented; budgets orchestration 2223, develop 615.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1014/1014 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0289 (F1), AR0290 (F2).

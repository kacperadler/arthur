# AR0289 - Outcome

- Merged: 2026-10-22, `cee3d3f`
- Branch: h/2026-10-22-ar0289-7722abc9
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.55, reviews $1.46; review rounds 2

## What went in

- `packages/schedule/src/sweep.ts`: one function writes the `[scheduled <id>]` text for a due action, a job that fails to start, and the new `schedule.message(id, message, procedure)`, which refuses a bad id, an empty message or a procedure that is not text.
- `packages/develop/src/eval-scenario.ts`: a scheduled turn's text comes from `schedule.message`; an invalid id or a missing schedule plugin fails only that scenario.
- Docs: `packages/schedule/docs/commands/schedule.md`, `packages/develop/docs/commands/eval.md`, `docs/plugin-api.md`. Budgets schedule 585, develop 668.
- Tests: `packages/schedule/test/registered.test.ts` (the real sweep's texts equal `schedule.message`'s, each refusal), `packages/develop/test/eval.test.ts`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1030/1030 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0301 (F1).

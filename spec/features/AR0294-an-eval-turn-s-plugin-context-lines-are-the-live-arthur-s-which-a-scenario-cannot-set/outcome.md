# AR0294 - Outcome

- Merged: 2026-10-22, `dae5a18`
- Branch: h/2026-10-22-ar0294-31b8ea0c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.33, reviews $1.13; review rounds 2

## What went in

- `packages/orchestration/src/context.ts`, `orchestration.ts`: `coordinator.checkoutContext` takes `{ root, at, context }`; in an eval each plugin's lines come from the scenario's `context`, a plugin left out adds nothing, an unknown name is refused.
- `packages/develop/src/eval-scenario.ts`, `eval-run.ts`, `eval-command.ts`: a scenario's `context` is read, checked and passed on (`{}` when left out).
- The two session scenarios set `context.session`; their `needs` are gone.
- Docs: `packages/develop/docs/commands/eval.md`, `packages/orchestration/docs/commands/coordinator.md`, `docs/plugin-api.md`. Budgets orchestration 2285, develop 670.
- Tests: `packages/orchestration/test/context.test.ts`, `packages/develop/test/eval.test.ts`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1034/1034 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

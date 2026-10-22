# AR0279 - Outcome

- Merged: 2026-10-22, `f582f7d`
- Branch: h/2026-10-22-ar0279-ba46bace
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $6.99, reviews $1.99; review rounds 2

## What went in

- `packages/core/src/board.ts`, `roles.ts`, `plugin-host.ts`: `board.digest` and `jobs.vision` take an optional `checkout` folder and read that copy's board or vision; `docs/plugin-api.md` records it.
- `packages/orchestration/src/context.ts`, `orchestration.ts`: `coordinator.checkoutContext` builds a coordinator context for a copy: the main project's role and criteria, the copy's vision and board, `## Time` at a given hour (day or night by the owner's quiet hours), and each plugin's lines.
- `packages/develop/src/eval-run.ts`, `eval-command.ts`, `eval-scenario.ts`: each eval turn gets that context for its fixture at the hour the scenario sets; `morning-report`, `night-one-line`, `after-restart-plan` and `unblocked-after-restart` set theirs.
- `test/structure.test.ts`: budgets core 5753, orchestration 2231, develop 655.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1018/1018 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0294 (F1), AR0295 (F2).

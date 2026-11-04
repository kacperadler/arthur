# AR0609 - Outcome

- Merged: 2026-11-04, `84d73bfe`
- Branch: arthur/2026-11-04-worker-43c41aa2
- Reviews: review-1.md PASS
- Cost: worker $2.13, reviews $0.27; review rounds 1

## What went in

- `packages/core/src/roles.ts`: `Role.personality`; a flagged role's prompt ends with its own `<role>.personality.md` or the shared `personality.md`, below every rule; a non-boolean flag is refused at registration.
- `packages/core/src/roles-command.ts`: `arthur roles` shows a missing personality file as `none`.
- `packages/core/test/roles.test.ts`: tests for order and that the file appears once, the own file replacing the shared one, the worker and reviewer never reading it, missing, empty and symlinked files, the registration refusal, and the `arthur roles` line.
- `packages/core/docs/commands/roles.md`: documents item 5 (the personality), its states, refusals and listing line.
- `packages/orchestration/src/orchestration.ts`: registers `coordinator` with `personality: true`.
- `packages/orchestration/test/context.test.ts`: the coordinator's context and `arthur roles` include the personality after the criteria.
- `packages/orchestration/docs/commands/coordinator.md`: the coordinator's context names the personality file and its symlink refusal.
- `spec/vision.md`: adds a line under "Where the less obvious parts live" saying where the tone of the owner-facing agents lives.
- `test/structure.test.ts`: core line budget 7153, orchestration 2740.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1435/1506 passed.

## Left open

- Findings: none; no findings.md on this ticket.

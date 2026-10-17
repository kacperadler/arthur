# AR0110 - Outcome

- Merged: 2026-10-18, `5dfeb7e`
- Branch: h/2026-10-17-ar0110-maxagents-3fea9e09
- Reviews: review-1.md PASS
- Cost: worker $8.25, reviews $1.27; review rounds 1

## What went in

- `packages/orchestration/src/spawn-rules.ts`: each role's model, thinking level and the quick model from `roles`; `beforeSpawn` refuses an unknown thinking level, a model list (until entry 82), and any spawn or continue while `maxAgents` (default 3) jobs run, naming them.
- `packages/core/src/spawn-check.ts`, `lock.ts`: `beforeSpawn` checks run under `<home>/spawn.lock` until the record exists, so two spawns never both take the last slot.
- `arthur.config.example.ts`, docs: `maxAgents`, `roles`, `roles.quick`.
- `test/structure.test.ts`: orchestration budget 658 -> 690.
- GitHub CI on the branch: ci and site passed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 385/385 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0114 (F2); F1 dropped.
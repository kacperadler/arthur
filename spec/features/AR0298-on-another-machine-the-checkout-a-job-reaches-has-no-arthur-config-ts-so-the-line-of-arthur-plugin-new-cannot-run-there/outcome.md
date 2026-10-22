# AR0298 - Outcome

- Merged: 2026-10-22, `b9d649e`
- Branch: h/2026-10-22-ar0298-8e2fe51c
- Reviews: review-1.md PASS
- Cost: worker $2.27, reviews $0.59; review rounds 1

## What went in

- `packages/develop/src/plugin-new.ts`: a worker on another machine gets no `arthur plugin new` line; it is told the repository there is bare, the package is made on the local machine, and to end asking for `arthur spawn --machine local`. The planner's section says the plan names `--machine local`. Budget develop 672.
- `packages/orchestration/roles/coordinator/plan-ended.md`: step 4 spawns the worker with `--machine local` when the plan says so.
- `packages/develop/docs/commands/plugin.md`, `packages/develop/test/plugin-new.test.ts`: the other-machine case.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1035/1035 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0304 (F1).

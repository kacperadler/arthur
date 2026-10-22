# AR0274 - Outcome

- Merged: 2026-10-22, `aa8e03e`
- Branch: h/2026-10-22-ar0274-117ece9b
- Reviews: review-1.md PASS
- Cost: worker $2.26, reviews $0.77; review rounds 1

## What went in

- `packages/develop/src/plugin-new.ts`: `pluginNewSection` gives the planner and the worker, only in Arthur's own repository, the line `cd <checkout> && arthur plugin new <name> --budget <lines> --root <worktree>`, the worker's with its real worktree filled in.
- `packages/develop/src/develop.ts`: turns that prompt section on.
- `packages/develop/docs/commands/plugin.md`, `packages/develop/docs/develop.md`, `docs/plugin-api.md`: describe the section. Budget develop 667.
- `packages/develop/test/plugin-new.test.ts`: both sections, no section for other roles or other projects.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1024/1024 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0298 (F1).

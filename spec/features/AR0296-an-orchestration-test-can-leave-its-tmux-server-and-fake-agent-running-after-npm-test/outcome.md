# AR0296 - Outcome

- Merged: 2026-10-22, `5249d15`
- Branch: h/2026-10-22-ar0296-20b416b1
- Reviews: review-1.md PASS
- Cost: worker $2.21, reviews $0.43; review rounds 1

## What went in

- `packages/orchestration/test/coordinator-end.ts` (new): `endCoordinator(t, socket, supervisor)` stops the supervisor and then kills the test's tmux server in `finally`, so a failed stop still leaves no server and still fails the test.
- `packages/orchestration/test/coordinator.test.ts`, `inbox.test.ts`, `silent.test.ts`: their setup helpers and the MCP test's second supervisor end through it; a proof test covers both paths.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1033/1033 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0303 (F1).

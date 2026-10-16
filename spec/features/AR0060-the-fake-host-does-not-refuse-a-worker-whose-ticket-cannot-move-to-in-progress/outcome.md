# AR0060 - Outcome

- Merged: 2026-10-16, `e5aa2d6`
- Branch: h/2026-10-16-ar0060-fake-host-refuses-f4ebb0ee
- Reviews: review-1.md PASS
- Cost: worker $1.04, reviews $0.44; review rounds 1

## What went in

- `packages/core/src/board-jobs.ts`: `refuseUnstartableTickets`, the core's ticket check, used by both `loadPlugins` and `fakeHost`.
- `testing.ts`: the fake host wires the check and the move at the first spawn, so a plugin's own checks and `job-started` handlers run first, as in a real load; its comment says a plugin must not rely on the ticket status at `job-started`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 241/241 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0062 (F1).

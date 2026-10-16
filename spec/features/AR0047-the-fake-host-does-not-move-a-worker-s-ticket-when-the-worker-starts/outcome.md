# AR0047 - Outcome

- Merged: 2026-10-16, `a1abefa`
- Branch: h/2026-10-16-ar0047-fake-host-moves-t-504c50d5
- Reviews: review-1.md PASS
- Cost: worker $0.88, reviews $0.35; review rounds 1

## What went in

- `packages/core/src/board-jobs.ts`: `moveStartedTickets`, the `job-started` subscription that moves a worker's tickets, used by both `loadPlugins` and `fakeHost`; on the fake host a worker's planned ticket moves to in-progress as in a real load.

## Checks on main

- `npm run check`: passed.
- `npm test`: 234/234 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0060 (F1), AR0061 (F2).

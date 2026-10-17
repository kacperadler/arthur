# AR0093 - Outcome

- Merged: 2026-10-17, `1822526`
- Branch: h/2026-10-17-ar0093-3007e5d9
- Reviews: review-1.md PASS
- Cost: worker $0.69, reviews $0.36; review rounds 1

## What went in

- `packages/core/src/job-records.ts`: the runner's `prune` takes ids or `"all"`; an empty list throws and an empty id is refused before anything is removed.
- `packages/core/src/job-commands.ts`: `arthur prune --all` passes `"all"`.
- `packages/core/src/ticket-command.ts`: an empty word after any `arthur ticket` verb prints the usage, exit 2, before the board is read.
- `ticket.md`: the empty-word rule for every verb.

## Checks on main

- `npm run check`: passed.
- `npm test`: 340/340 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- F1: dropped (style only).

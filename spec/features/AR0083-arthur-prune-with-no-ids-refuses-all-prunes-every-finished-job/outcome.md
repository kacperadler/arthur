# AR0083 - Outcome

- Merged: 2026-10-17, `d799302`
- Branch: h/2026-10-17-ar0083-9f8db889
- Reviews: review-1.md PASS
- Cost: worker $0.00, reviews $1.00; review rounds 1

## What went in

- `packages/core/src/job-commands.ts`: a bare `arthur prune` prints its usage and exits 2; `--all` frees every finished job and is refused with ids; an empty word in `stop`, `steer`, `continue` or `prune` exits 2 before anything runs.
- `packages/core/src/ticket-command.ts`: `ticket status` with an empty id or status prints its usage, exit 2.
- `prune.md`, `stop.md`, `steer.md`, `continue.md`, `ticket.md`: the usage and refusals.
- `spec/roadmap.md`: entry 23 carries the coordinator rule that prune names its ids.

## Checks on main

- `npm run check`: passed.
- `npm test`: 339/339 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0093 (F1, F2).

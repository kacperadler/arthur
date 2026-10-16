# AR0035 - Outcome

- Merged: 2026-10-16, `a8039bf`
- Branch: h/2026-10-16-ar0035-command-events-re-21f43133
- Reviews: review-1.md PASS
- Cost: worker $2.00, reviews $0.58; review rounds 1

## What went in

- `packages/core/src/events.ts`: `follow(everyMs)`: from the log's end, reads only when it grew, whole lines only, skips its own events, restarts from the end when the log is cut.
- `run.ts`: `arthur run` follows every 500 ms after taking its lock and stops before the first plugin `stop`; events a command appends reach the daemon's subscribers. No socket or port.

## Checks on main

- `npm run check`: passed.
- `npm test`: 159/159 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0044 (F1), AR0045 (F2).

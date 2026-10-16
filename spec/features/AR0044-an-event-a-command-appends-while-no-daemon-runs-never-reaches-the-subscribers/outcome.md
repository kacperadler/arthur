# AR0044 - Outcome

- Merged: 2026-10-16, `f7beab3`
- Branch: h/2026-10-16-ar0044-events-replay-aft-8791d5a8
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $3.74, reviews $1.01; review rounds 3

## What went in

- `packages/core/src/events.ts`: `arthur run` keeps the last delivered event's number in `<home>/events.delivered` (temp + rename, after the handlers) and at start delivers every later event, before any plugin's `start`; a first start begins at the end; a bad or cut number warns once and starts at the end. SIGTERM never redelivers; SIGKILL mid-handlers may.
- `event-log.ts`: the log-file code, split out of `events.ts`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 186/186 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0050 (F1), AR0051 (F2).

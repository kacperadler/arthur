# AR0522 - Outcome

- Merged: 2026-10-29, `8c353fd9`
- Branch: arthur/2026-10-29-worker-3dd167e9
- Reviews: review-1.md PASS
- Cost: worker $2.44, reviews $0.64; review rounds 1

## What went in

- When `arthur run` stops, it keeps `run.pid` until every sweep still running (a copy from another machine included) has ended, and removes it right after; with none running it is released at once, as before. So a new `arthur run` can no longer start while the old one's copy still writes job records.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1202/1270 passed.

## Left open

- Findings: F1 deferred (client summary): while the stop waits, a second Ctrl-C does nothing, and a local sweep that never ends would block it; F2 dropped (the no-sweep test notices only delays over 10 ms).

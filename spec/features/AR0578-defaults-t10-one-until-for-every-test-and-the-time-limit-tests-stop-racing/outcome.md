# AR0578 - Outcome

- Merged: 2026-10-30, `a18ef20c`
- Branch: arthur/2026-10-30-worker-f9e3eee7
- Reviews: review-1.md PASS
- Cost: worker $6.14, reviews $1.32; review rounds 1

## What went in

- test(AR0578): one kit until for every test, fixed waits capped
- test(AR0578): the kit's until fails at its deadline, not later
- docs(AR0578): example perJob cpu 3, with the suite times

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1298/1366 passed.

## Left open

- Deferred (client summary): F1. The structure check reads a quote or backtick inside a regex literal as the start of a string
- Deferred (client summary): F2. The fixed-wait baseline only refuses growth, so a file can climb back to its old count

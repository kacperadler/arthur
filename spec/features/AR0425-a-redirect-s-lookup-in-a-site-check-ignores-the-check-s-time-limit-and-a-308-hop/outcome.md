# AR0425 - Outcome

- Merged: 2026-10-28, `c133bb0d`
- Branch: arthur/2026-10-28-worker-04c1fca5
- Reviews: review-1.md PASS
- Cost: worker $1.88, reviews $0.55; review rounds 1

## What went in

- A site check whose redirect goes to a host whose lookup never answers now ends at the check's time limit with `no answer within <n> s`, and starts no lookup once the limit has passed; each of the five redirect statuses (301, 302, 303, 307, 308) has a test.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1193/1261 passed.

## Left open

- Deferred (client summary): F1. A core limits test fails under load: its tool's process is not seen in time

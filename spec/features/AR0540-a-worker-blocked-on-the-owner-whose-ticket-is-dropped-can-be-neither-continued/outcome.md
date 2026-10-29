# AR0540 - Outcome

- Merged: 2026-10-29, `030a7cf6`
- Branch: arthur/2026-10-29-worker-50638735
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $7.29, reviews $1.61; review rounds 2

## What went in

- `arthur stop` on a job blocked on the owner whose run is over now ends it (`ended`, reason `stopped`), on this machine or another one, so `arthur prune` can free it; a stop while a continue holds the job is refused (`being continued`), and a job blocked on a dependency is still refused. The core line budget went to 6440 (AR-D287).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1205/1273 passed.

## Left open

- Findings: none; the commit 0f19dc1d's subject still says "pending the owner's decision", which AR-D287 later gave.

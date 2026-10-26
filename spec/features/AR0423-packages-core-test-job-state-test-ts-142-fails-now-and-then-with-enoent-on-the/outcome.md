# AR0423 - Outcome

- Merged: 2026-10-26, `17d51ce6`
- Branch: arthur/2026-10-26-worker-94b1045b
- Reviews: review-1.md PASS
- Cost: worker $0.92, reviews n/a; review rounds 1

## What went in

- `packages/core/test/job-state.test.ts`: `silent()` reads the job's `active` file with `throwIfNoEntry: false` and counts a missing file as 0 ms of silence, so the checks wait until the wrapper writes it (it writes `pid`, which ends the spawn, two lines before `active`) instead of throwing `ENOENT`. No source file changed.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1144/1150 passed.

## Left open

- F1 to F2: dropped under AR-D53 (see findings.md).

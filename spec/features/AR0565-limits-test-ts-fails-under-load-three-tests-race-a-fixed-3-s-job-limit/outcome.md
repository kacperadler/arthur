# AR0565 - Outcome

- Merged: 2026-10-30, `4888ddf5`
- Branch: arthur/2026-10-30-worker-42aeee73
- Reviews: review-1.md PASS
- Cost: worker $2.06, reviews $0.69; review rounds 1

## What went in

- `packages/core/test/limits.test.ts`: the three timeout tests (tool call, install, SIGKILL after the grace) wait for the awaited state or the job's end, whichever comes first, and assert the time-limit reason when the end came first; a lost race reruns with a 3, 6, 12 then 24 s limit in fresh folders, and fails past 24 s. Test 3's fake agent paces its spend from the wrapper's start (the `pid` file's mtime). `until` gives up after 60 s instead of 20.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1241/1309 passed.

## Left open

- Deferred (client summary): F1. The commit subject uses scope core, not the ticket id.
- Deferred (client summary): F2. until now waits 60 s in every test of limits.test.ts, so a hung test takes 60 s to fail instead of 20 s.
- Deferred (client summary): F3. Test 3's fake agent relies on GNU date -r ... +%s%3N.

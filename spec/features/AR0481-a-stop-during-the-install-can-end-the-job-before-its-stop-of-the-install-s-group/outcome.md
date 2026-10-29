# AR0481 - Outcome

- Merged: 2026-10-29, `e80132da`
- Branch: arthur/2026-10-29-worker-00ef886c
- Reviews: review-1.md PASS
- Cost: worker $1.20, reviews $0.65; review rounds 1

## What went in

- A stop or a limit that comes while a job's install runs now waits until the install's process group is stopped (SIGKILL after the grace included) before the job ends, so no install process outlives its job; without a stop nothing changes.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1200/1268 passed.

## Left open

- Findings: F1 deferred (client summary): the new test needs the stop to land in a 2 s window, as the AR0464 test does; F2 dropped (a stray sleep the reviewer saw, not from this branch).

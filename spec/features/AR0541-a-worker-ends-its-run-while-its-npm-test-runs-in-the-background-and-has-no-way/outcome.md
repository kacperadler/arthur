# AR0541 - Outcome

- Merged: 2026-10-29, `fadd4657`
- Branch: arthur/2026-10-29-worker-8705208f
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $4.45, reviews $1.42; review rounds 2

## What went in

- Every job's agent runs with omp's background moves turned off, so a bash call (`npm test` included) stays in the call and its result reaches the agent before its run ends; the worker role gives each check a bash timeout of 1800 s, since a call with none is killed at 300 s with no result. The spawn doc says so plainly.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1200/1268 passed.

## Left open

- Deferred (client summary): F1. A job's agent still gets omp's named services and `proc://` writes, which need the broker the sandbox closes
- Deferred (client summary): F2. The install-timeout test of limits.test.ts times out under load

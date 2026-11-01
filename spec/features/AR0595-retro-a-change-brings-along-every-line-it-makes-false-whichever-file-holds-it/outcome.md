# AR0595 - Outcome

- Merged: 2026-11-01, `3989d460`
- Branch: arthur/2026-11-01-worker-5177b15d
- Reviews: review-1.md PASS
- Cost: worker $0.70, reviews $0.19; review rounds 1

## What went in

- packages/core/roles/worker.md: the "Stay inside the task" bullet has a worker fix every line its change makes false, in any file the Scope's Out does not exclude. It searches the repository before the final message and files a line of the vision as a finding instead.
- spec/features/AR0595-retro-a-change-brings-along-every-line-it-makes-false-whichever-file-holds-it/findings.md: new; F1, the autopilot criterion that still says a fix never grows past its Scope.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1387/1456 passed.

## Left open

- Deferred (client summary): F1. The autopilot criterion still says a fix never grows past its Scope
- Deferred (client summary): F2. the autopilot criterion clashes with the new rule

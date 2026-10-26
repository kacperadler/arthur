# AR0354 - Outcome

- Merged: 2026-10-26, `7231be19`
- Branch: arthur/2026-10-26-worker-f7deae1c
- Reviews: review-1.md PASS
- Cost: worker $6.57, reviews n/a; review rounds 1

## What went in

- `packages/core/src/inside-job.ts` (`@arthur/core/inside-job`): `insideJob(home)` tells a job by its systemd scope (`/proc/self/cgroup` ending in `arthur-job-<id>.scope`, with `<home>/jobs/<id>` existing), falling back to `ARTHUR_JOB` where there is no systemd; a job's shell clearing the variable no longer makes it the coordinator.
- Every refusal uses it: the CLI's job gate, `remote-job`, `decision`, `youtrack` writes, `schedule add`/`remove`, `ci --rerun`, `plugin new`.
- `docs/deploy.md` ("Threat model"): a job may still set up a home of its own and act as its coordinator (AR-D46; the sandbox is the real bound).
- Tests: each refusal with `ARTHUR_JOB` cleared, inside a job's scope; they skip where there is no scope.
- `test/structure.test.ts`: budgets raised under AR-D29 (core 6184, orchestration 2399, develop 706, github 659, schedule 595, youtrack 661).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1138/1144 passed.

## Left open

- Tickets from findings: AR0443 (F1: a job acting as the coordinator of a home of its own; planning, for the owner with the sandbox work); the review's notes (a worse message from `plugin new` without systemd, a stale comment in the structure test) dropped as wording.

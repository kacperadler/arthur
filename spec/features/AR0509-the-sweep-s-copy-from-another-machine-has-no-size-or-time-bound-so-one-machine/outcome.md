# AR0509 - Outcome

- Merged: 2026-10-27, `38558fd4`
- Branch: arthur/2026-10-27-worker-61d50fad
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $13.36, reviews $3.46; review rounds 2

## What went in

- `packages/core/src/job-machine.ts`: `execute` takes a time limit and a cap on the answer's size; past 64 MiB it kills ssh and fails, past the limit it says `timed out after <n> s`; both count as the machine unreachable, so the offline grace applies.
- `packages/core/src/machine-sync.ts`: the sweep's copy runs over `sshAsync` with a 20 s limit and the 64 MiB cap, resumes a cut log from `logTo`, writes nothing for a job whose `synced` changed while it asked, and moves a job's state only once its whole log is here.
- `packages/core/src/remote-job.ts`: `records` sends at most 256 KiB of log per job, cut on a character boundary, and says where it stopped (`logTo`).
- `packages/core/src/jobs.ts`, `run.ts`, `job-control.ts`, `job-records.ts`: the sweep copies every machine at once and awaits it, so `arthur run` keeps answering; spawn, continue and stop await their copy too.
- `packages/core/test/machine.test.ts`, `job-records.test.ts`: a 1.2 MB log arrives over several copies, a binary log is cut, a `records` that never answers is held offline while a timer keeps firing, a 100 MiB answer leaves the process alive, two copies at once write the log once.
- `packages/core/docs/commands/spawn.md`, `remote-job.md`: the limits, `logTo` and the refusal lines.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1145/1212 passed.

## Left open

- Tickets from findings: AR0520 (F1), AR0521 (F2), AR0522 (F3).

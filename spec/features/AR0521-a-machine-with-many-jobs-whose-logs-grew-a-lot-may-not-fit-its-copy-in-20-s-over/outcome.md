# AR0521 - Outcome

- Merged: 2026-11-05, `5b6e46e6`
- Branch: arthur/2026-11-05-worker-48c495a2
- Reviews: review-1.md PASS
- Cost: worker $2.28, reviews $0.41; review rounds 1

## What went in

- packages/core/src/remote-job.ts: `records` caps the log at 256 KiB per job and 512 KiB per answer; each job, in the order asked, gets what is left divided among the jobs not read yet.
- packages/core/src/machine-sync.ts: the copy-limits comment names both log caps (per job and per answer).
- packages/core/test/machine.test.ts: a test where five jobs, all far behind, are copied over a link that carries 1 MiB in 20 s: one bounded answer, `synced` moves forward, no job is held offline, the rest arrives in later sweeps, and a job asked first with little to send leaves its share to the jobs after it.
- packages/core/docs/commands/remote-job.md: `records` brings at most its share of a log; the 512 KiB total and how it is shared out.
- packages/core/docs/commands/spawn.md: the sweep's copy brings 256 KiB per job and 512 KiB for all of a machine's jobs together per copy.
- packages/core/docs/commands/config.md: the gap for a value cut inside one long line refers to the piece a copy brings (256 KiB at most).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1481/1552 passed.

## Left open

- Deferred (client summary): F1. the cap counts raw log bytes, not the size of the JSON answer

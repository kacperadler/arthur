# AR0751 - A job's default time limit covers check, test and mutate on 2 cores

```json
{
  "id": "AR0751",
  "title": "A job's default time limit covers check, test and mutate on 2 cores",
  "date": "2026-11-27"
}
```

## Description

A job's default time limit goes from 120 to 240 minutes, so a worker or a review on the 2 cores each job gets can finish `npm run check`, `npm test` and `npm run mutate` without being cut and continued.

## Goal

Jobs were cut at the 2-hour limit in the middle of verification all week, and each continue costs a coordinator steer and a reload of the whole conversation (AR-D729: one resumed round spent $8, almost all on reloading).

Evidence (retro spec/retro/2026-11-27.md, proposal 2):
- Corrections: "You ran past the 2-hour limit during mutate", "during a repeated mutate", "the previous review of this branch ran out its 120 minutes without a verdict".
- AR0740 continues restarting a cut mutate ("saved at 72 of 94", "saved at 50 tried").
- Cause: `arthur.config.ts:41` sets `perJob: { cpu: 2 }` since AR-D701, `test/mutate.ts:81` stops starting mutants 1500 s into a call, and the config sets no `core.jobs.timeoutMinutes`, so the default 120 holds (`packages/core/src/config.ts:115`).

Risk: a stuck job holds its slot up to 4 hours instead of 2; its budget and the loop stop still cap its cost.

- Kind: chore

## Done means

- A config without `core.jobs.timeoutMinutes` loads with a job time limit of 240 minutes; a test in `packages/core/test/` asserts the loaded default and fails on the current code.
- A config that sets `timeoutMinutes` still gets its own value.
- The doc page that names the default says 240.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/config.ts`: the `jobs` default, `timeoutMinutes: core.jobs?.timeoutMinutes ?? 240`.
- The core config test, and the doc page that states the default.

Out:
- `perJob.cpu` in the owner's config.
- mutate's own 1500 s call limit.

## Decisions

- 2026-11-27: Source: retro spec/retro/2026-11-27.md

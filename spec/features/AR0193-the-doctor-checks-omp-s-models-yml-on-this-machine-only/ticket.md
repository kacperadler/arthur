# AR0193 - The doctor checks omp's `models.yml` on this machine only

```json
{
  "id": "AR0193",
  "title": "The doctor checks omp's `models.yml` on this machine only",
  "date": "2026-10-19"
}
```

## Description

a job on another machine runs that machine's omp, whose own `~/.omp/agent/models.yml` may configure `ollama` or `lm-studio` and so replace the provider the job's environment sets; `arthur doctor` reads only the local file.

## Goal

`arthur doctor` checks omp's `models.yml` on every machine a provider model can run on, not only this one.

- Kind: improvement

Evidence:
- `packages/models/src/model-doctor.ts` (`omp models.yml`)
- Found by: 2026-10-19-ar0187-models-d5226cf4 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: a doctor line per registered machine that reads its `models.yml` through `host.jobs.run` (`cat`, absent is ok), critical as the local one. Out: the provider probes, which already run from the job's machine at spawn.
- `npm test` and `npm run check` pass.

## Scope

In:
- a doctor line per registered machine that reads its `models.yml` through `host.jobs.run` (`cat`, absent is ok), critical as the local one. Out: the provider probes, which already run from the job's machine at spawn.

## Decisions

- 2026-10-19: Source: F4 of AR0187
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.

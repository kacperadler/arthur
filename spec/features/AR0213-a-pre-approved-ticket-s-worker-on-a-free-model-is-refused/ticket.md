# AR0213 - A pre-approved ticket's worker on a free model is refused

```json
{
  "id": "AR0213",
  "title": "A pre-approved ticket's worker on a free model is refused",
  "date": "2026-10-19"
}
```

## Description

the core gives a job on a free model (`models.pick` answers `free: true`) the budget 0 before the `beforeSpawn` checks run, and AR0154's check refuses a worker on a pre-approved ticket with a budget of 0 (no limit), so such a worker cannot start on a free model, though it would spend nothing [INFERENCE: read from the lines, not run with the models plugin].

## Goal

A pre-approved ticket's worker on a free model starts, its budget of 0 read as free, not as no limit.

- Kind: bug

Evidence:
- `packages/core/src/jobs.ts:164`, `packages/orchestration/src/plans.ts` (`overBudget`)
- Found by: 2026-10-19-ar0154-orchestration-bat-095bb636 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: give `Spawn` whether its model is free (the `free` that `pickModel` returns), and let the check pass a budget of 0 on a free model; the check of a paid model stays as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- give `Spawn` whether its model is free (the `free` that `pickModel` returns), and let the check pass a budget of 0 on a free model; the check of a paid model stays as it is.

## Decisions

- 2026-10-19: Source: F1 of AR0154
- 2026-10-19: Approved under the owner's word of the same day: findings are built in batches or with the roadmap entry that touches the same files.

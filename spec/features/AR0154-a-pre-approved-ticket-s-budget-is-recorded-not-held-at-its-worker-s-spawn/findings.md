# AR0154 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. A pre-approved ticket's worker on a free model is refused

- Kind: bug
- Found by: 2026-10-19-ar0154-orchestration-bat-095bb636 (worker), 2026-10-19
- Where: `packages/core/src/jobs.ts:164`, `packages/orchestration/src/plans.ts` (`overBudget`)
- What: the core gives a job on a free model (`models.pick` answers `free: true`) the budget 0 before the `beforeSpawn` checks run, and AR0154's check refuses a worker on a pre-approved ticket with a budget of 0 (no limit), so such a worker cannot start on a free model, though it would spend nothing [INFERENCE: read from the lines, not run with the models plugin].
- Suggestion: give `Spawn` whether its model is free (the `free` that `pickModel` returns), and let the check pass a budget of 0 on a free model; the check of a paid model stays as it is.
- Status: open

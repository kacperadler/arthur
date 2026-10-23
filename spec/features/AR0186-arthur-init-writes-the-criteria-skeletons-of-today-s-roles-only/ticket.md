# AR0186 - `arthur init` writes the criteria skeletons of today's roles only

```json
{
  "id": "AR0186",
  "title": "`arthur init` writes the criteria skeletons of today's roles only",
  "date": "2026-10-19"
}
```

## Description

the roles registered today read `styleguide` (worker, planner, plan reviewer, coordinator) and `autopilot` (coordinator), so `init` writes those two. The reviewer (52), the auditor and the retro will read more criteria files (`review`, `audit`, `retro` in Arthur's own repository); a plugin cannot list the registered roles (`host.jobs` has `prompt` and `vision` only), so the projects plugin keeps its own list, which those entries must extend, and a project onboarded before them lacks those files.

## Goal

`arthur init` writes a criteria skeleton for every role that reads one, including roles added later, not only today's.

- Kind: feat

Evidence:
- `packages/projects/src/init.ts` (`CRITERIA = ["styleguide", "autopilot"]`), `packages/projects/skeleton/criteria/`
- Found by: 2026-10-19-ar0181-onboarding-f9194d6e (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: either each entry that adds a role with criteria adds its skeleton to `packages/projects/skeleton/criteria/` and to `CRITERIA`, or the core publishes the criteria names the registered roles read (`host.jobs.criteria()`), and `init` writes one skeleton per name. Out: drafting those files for projects onboarded earlier.
- `npm test` and `npm run check` pass.

## Scope

In:
- either each entry that adds a role with criteria adds its skeleton to `packages/projects/skeleton/criteria/` and to `CRITERIA`, or the core publishes the criteria names the registered roles read (`host.jobs.criteria()`), and `init` writes one skeleton per name. Out: drafting those files for projects onboarded earlier.

## Decisions

- 2026-10-19: Source: F4 of AR0181
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.

# AR0006 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. An instance name can produce the same variable prefix as another plugin

- Kind: risk
- Found by: 2026-10-16-ar0006-config-env-names-8aca9224 (worker), 2026-10-16
- Where: `packages/core/src/env.ts` (`nameProblem`, `prefix`, `part`)
- What: a `youtrack` instance named `cloud` and a plugin named `youtrack-cloud` both own the prefix `ARTHUR_YOUTRACK_CLOUD_`; each may use `ARTHUR_YOUTRACK_CLOUD_TOKEN`, so one variable feeds two owners. Reproduced: `checkEnv` on those two plugins with the variable in the shell returns no problem and the value under both `youtrack` and `youtrack-cloud`. Likewise instance names `a-b` and `a b` both map to `A_B_` (not run). Not reachable with the example config.
- Suggestion: refuse two owners (plugins or instances of one plugin) with the same prefix in `checkEnv`, naming both; leave the naming scheme as it is.
- Status: ticket AR0028

## F2. README still says no feature code exists

- Kind: cleanup
- Found by: 2026-10-16-ar0006-config-env-names-8aca9224 (worker), 2026-10-16
- Where: `README.md:5`
- What: "No feature code exists" has been wrong since AR0005 merged `loadConfig`; AR0006 adds `arthur config check`.
- Suggestion: say what runs today (`arthur config check`) and that the rest is in the roadmap.
- Status: ticket AR0029

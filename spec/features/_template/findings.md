# K0000 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Short title

- Kind: feat | fix | security | perf | refactor | test | docs | build | ci | chore | ux
- Budget: <USD> (optional)
- Found by: <job id> (worker | review | coordinator), YYYY-MM-DD
- Where: `path/to/file.ts:42`
- What: what was seen, and how to reproduce it.
- Suggestion: the change that would fix it, and what stays out.
- Status: open | fixed in <commit> | ticket K0000 | dropped (reason)

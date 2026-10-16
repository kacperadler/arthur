# AR0023 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The worktree guard knows only its own project's checkout

- Kind: risk
- Found by: 2026-10-16-ar0023-worktree-guard-a197f8a5 (worker), 2026-10-16
- Where: `packages/core/src/worktree-guard.ts` (`jobPlace`)
- What: the guard reads its places from the job's record: that project's main checkout (`root`), the home folder, and the folder holding the job's worktree (`<root>/../.arthur-worktrees`). Once entry 41 adds more projects, a job of one project may still write into another project's main checkout or its jobs' worktrees, since no record names them. Today the core has one project, so nothing is open yet.
- Suggestion: with entry 41, have the wrapper hand the guard every project's checkout and worktree folder (for example a file in the record the runner writes), and guard each; keep the guard's command parsing as it is.
- Status: ticket AR0059

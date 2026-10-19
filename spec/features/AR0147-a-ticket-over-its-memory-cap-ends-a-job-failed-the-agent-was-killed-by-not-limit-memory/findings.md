# AR0147 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A ticket's memory cap can be stretched by swap

- Kind: risk
- Found by: 2026-10-19-ar0145-resources-batch-00d689f3 (worker), 2026-10-19
- Where: `packages/core/src/job-scope.ts` (`setSlice`, `ownLimits`)
- What: `setSlice` gives a ticket's slice `CPUQuota` and `MemoryMax` only, no `MemorySwapMax`; a job's own scope gets `MemorySwapMax=0` only with its own `memory` cap. So the jobs of a ticket with `perFeature.memory` and no `perJob.memory` may swap past the ticket's cap before the kernel kills one, on a machine with swap. [INFERENCE] from the lines; not run: the AR0147 test gives its jobs their own `memory` of 1G so that their scopes take no swap and the slice's cap is reached at once.
- Suggestion: set `MemorySwapMax=0` on the ticket's slice when it has a memory cap (`infinity` when it has none), as the own scope does; out: the joint slice.
- Status: open

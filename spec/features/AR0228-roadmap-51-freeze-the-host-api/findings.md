# AR0228 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `host.jobs.block` without `stop` is used by no plugin

- Kind: cleanup
- Found by: 2026-10-20-ar0228-roadmap-51-freeze-619539f1 (worker), 2026-10-20
- Where: `packages/core/src/job-state.ts:81`, `packages/core/src/machine-sync.ts:73`, `packages/resources/src/feature-guard.ts:41`
- What: the only plugin call of `host.jobs.block` is resources' `block(job.id, text, true)`. The hold without `stop` (`blocked` on `dependency: <reason>` while the run goes on) is reached by no plugin; this ticket removed `unblock`, which no plugin called either, so such a hold now ends only with its run. Entry 51 removes members no plugin uses; it kept this parameter, since `block` itself is used and the hold's path runs through the wrapper's end and `machine-sync.ts` as well.
- Suggestion: decide whether `block(id, reason)` always stops the run (`user: <reason>`), dropping the `stop` flag and the `dependency:` hold with its branch in `machine-sync.ts`, or keeps it for a plugin to come (machines' offline jobs are held by the core itself, not through `block`). The change is in the frozen API, so the decision goes into that ticket.
- Status: dropped (keep the flag; AR0229 dropped)

## F2. `wrapper.ts:62` still says a held job waits for `unblock`

- Kind: cleanup
- Found by: 2026-10-20-review-ar0228-roadmap-51-41ae1c06 (review), 2026-10-20
- Where: `packages/core/src/wrapper.ts:62`
- What: the comment names `unblock`, which this ticket removed.
- Status: ticket AR0230

## F3. The budget comment's items sum to +17, the raise is +16

- Kind: cleanup
- Found by: 2026-10-20-review-ar0228-roadmap-51-41ae1c06 (review), 2026-10-20
- Where: `test/structure.test.ts`, the AR0228 comment above `BUDGETS`
- What: additions 31 and cuts 14 give +17; the measured count and the budget are both 5684.
- Status: ticket AR0230

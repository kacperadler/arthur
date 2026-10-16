# AR0065 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A continued worker leaves its ticket in review or done

- Kind: bug
- Found by: 2026-10-16-ar0065-continue-runs-bef-39824cd9 (worker), 2026-10-16
- Where: `packages/core/src/job-control.ts` (`continueJob`), `packages/core/src/board-jobs.ts` (`moveStartedTickets`)
- What: the core moves a worker's tickets to in-progress on `job-started`, which only a spawn emits; `continueJob` emits none. Since AR0065 the core's `beforeSpawn` lets a continue through on a ticket in `review` or `done` (as a spawn), but the ticket then stays in `review` or `done` while the worker runs again. [INFERENCE: from those lines; not run.]
- Suggestion: on a continue the core moves the record's tickets to in-progress as at a spawn (an event of its own, or the move called from the continue); what other plugins see of a continue stays out.
- Status: open

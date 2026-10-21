# AR0247 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A hand-back refused for good is retried at every run's end, silently

- Kind: risk
- Found by: 2026-10-21-ar0247-roadmap-55-hand-b-835027a0 (worker), 2026-10-21
- Where: `packages/delivery/src/hand-back.ts` (`step`, the `refused by ` test)
- What: every `beforeSpawn` refusal keeps the hand-back's step and tries it again at the next `job-ended`, as entry 55 asks for `maxAgents` and the resources plugin's room. A refusal that no freed slot lifts is kept the same way: the core's own check of a worker whose ticket cannot move to in-progress (the owner merged or dropped it meanwhile), or delivery's own review refusals (the ticket moved to planned by hand). The hand-back then waits for ever, retried at each run's end, and the coordinator is never told; only `arthur stopall` ends it, and nothing cancels a single hand-back.
- Suggestion: tell the coordinator once, on a step's first refusal, with the reason (kept in the hand-back's record so it is said once), or end the hand-back on a refusal by `core` or `delivery`, which a freed slot never lifts; leave the retry of other plugins' refusals as it is.
- Status: open

## F2. A review stopped by `arthur stopall` wakes the coordinator with "Review again"

- Kind: bug
- Found by: 2026-10-21-ar0247-roadmap-55-hand-b-835027a0 (worker), 2026-10-21
- Where: `packages/delivery/src/delivery.ts` (`wake`, the no-verdict line)
- What: a review that `arthur stopall` stopped (reason `stopped`), or that the hand-back stopped as `stop-all` came (`blocked` on `user: arthur stopall cancelled delivery's hand-back`), ends with no verdict, and its wake says `no verdict, so the review failed ... Review again with arthur review <worker>`: an instruction to start again what the owner just stopped. The no-verdict wake predates entry 55; the hand-back adds the second case.
- Suggestion: for a review whose run was stopped (reason `stopped`, or held on `user:`), the wake says it was stopped and only names `arthur prune <id>`; the line for a run that did not finish otherwise stays.
- Status: open

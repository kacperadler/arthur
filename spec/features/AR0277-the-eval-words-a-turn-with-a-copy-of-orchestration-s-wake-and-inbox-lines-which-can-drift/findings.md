# AR0277 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The eval still words a schedule entry with its own copy of the schedule plugin's `[scheduled <id>]` line

- Kind: risk
- Found by: 2026-10-22-ar0277-eval-turn-wording-9459b77a (worker), 2026-10-22
- Where: `packages/develop/src/eval-scenario.ts` (`turnText`, the `coordinator-message` text), copying `packages/schedule/src/sweep.ts:39`
- What: since AR0277 the eval asks orchestration for the turn (`coordinator.turn`), so the `[Arthur]` mark, the wake and the closing line follow orchestration. The text of a schedule entry's `coordinator-message`, `[scheduled <id>] <message>` with its procedure under a blank line, is still built by develop: a change of that wording in the schedule plugin leaves `{ scheduled, ... }` scenarios replaying the old text, and nothing fails.
- Suggestion: the schedule plugin provides the text of an action due (say `schedule.message`, answering `(id, message, procedure text)`), which develop asks instead of its copy; the sweep itself and its late mark stay out.
- Status: open

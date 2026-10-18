# AR0112 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A new owner message waits behind a failed turn's pause, up to 5 min

- Kind: risk
- Found by: 2026-10-18-ar0112-redelivery-backof-852933a6 (worker), 2026-10-18
- Where: `packages/orchestration/src/inbox-extension.ts` (`tick`, the `Date.now() < resume` check)
- What: while the messages of failed turns wait (5 s doubling to 5 min), a message the owner sends meanwhile is queued and goes only when the wait ends, together with them, since an idle turn always hands every waiting message with the new ones. After a model outage that has just ended, the owner's "are you there?" can sit for up to 5 min. The wait lives in the extension's process, so a restart of the coordinator ends it.
- Suggestion: decide whether a new owner message (one with a channel) should end the wait and start a turn at once with the waiting ones; a job's end and a schedule message keep waiting.
- Status: open

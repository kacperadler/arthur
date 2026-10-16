# AR0041 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `/restart fresh` starts a new conversation without the handoff

- Kind: improvement
- Found by: 2026-10-16-r0041-session-handoff-ro-c1afd10a (worker), 2026-10-16
- Where: `spec/roadmap.md:342` (entry 36)
- What: after this ticket, compaction (35) and the nightly fresh start (36) write `.arthur/session/handoff.md` first and the next conversation reads it; `/restart fresh` still starts a new conversation (no `--continue`) with only `after-restart.md`, which holds steps for the human's `Restarted.` message, not the coordinator's work in progress or its unanswered questions. A question to the human asked before `/restart fresh` is lost, which is what the Goal of AR0041 rules out for the other two paths.
- Suggestion: in entry 36, `/restart fresh` writes the same handoff before it stops the session (a failed write refuses the command with one line), and the new conversation reads it; plain `/restart` keeps `--continue` and needs none. `after-restart.md` stays as it is.
- Status: ticket AR0043

# AR0111 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A `/compact` typed in the coordinator's pane for more than 30 s delivers a hand-over made meanwhile twice

- Kind: risk
- Found by: 2026-10-18-ar0111-handover-watchdog-c415e11b (worker), 2026-10-18
- Where: `packages/orchestration/src/inbox-extension.ts` (`tick`, `QUIET_MS`)
- What: measured against omp 18.3.0 with a fake OpenAI-compatible provider: during a manual `/compact` `ctx.isIdle()` stays true, the inbox hands a queued message over, and omp holds that prompt until the compaction ends (17 s there). Past 30 s the watchdog counts the hand-over as lost and hands it again; both prompts then run, the agent sees the message twice, and the second turn's reply is not sent (its `handed` is empty). omp's own compaction before a prompt and after a turn is busy (`isIdle()` false) and is not affected.
- Suggestion: have the watchdog, and the hand-over in `tick`, wait while a compaction runs, from `session_before_compact` to `session_compact`, with a cap, since a failed manual compaction emits no end event to extensions (read in the bundle, not run).
- Status: open

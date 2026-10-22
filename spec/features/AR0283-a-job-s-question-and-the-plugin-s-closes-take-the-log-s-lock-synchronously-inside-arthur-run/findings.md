# AR0283 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A crash of `arthur run` while a job's question waits for the log's lock loses its notice

- Kind: risk
- Found by: 2026-10-22-ar0283-2e1ee31c (worker), 2026-10-22
- Where: `packages/orchestration/src/blocked-notice.ts` (the `asked/` mark, then the notice after `askOfJob`)
- What: the handler creates its mark `<home>/orchestration/asked/<event number>-<time>` before it asks in the decision log, and sends the notice after. Since AR0283, while another process holds the log's lock, the notice waits for the lock (up to 60 s) with the mark already made: a crash or restart of `arthur run` in that wait leaves the mark, so the replay after the restart sends no notice and the owner never hears the question. Before, the gap between the mark and the notice was one synchronous write. [INFERENCE] from the lines; not reproduced.
- Suggestion: keep a second mark (`asked/<n>-<time>.sent`) written after the notice, and let a replay that finds the first mark without the second look up the job's open question in the log (asking again only when there is none) and send the notice; the one-notice-per-block rule stays.
- Status: ticket AR0299

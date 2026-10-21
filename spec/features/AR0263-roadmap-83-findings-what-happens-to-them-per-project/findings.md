# AR0263 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The procedure after a merge settles review notes as tickets whatever the project's findings mode

- Kind: improvement
- Found by: AR0263 worker (worker), 2026-10-21
- Where: `packages/delivery/roles/coordinator/after-merge.md:6`
- What: step 2 tells the coordinator to copy the reviews' non-blocking notes into `findings.md` and settle each as a planning ticket or `dropped`. In a project whose `findings.mode` is `summary` (a client's) those notes become board tickets anyway, and in a `grouped` project one ticket each, so the mode only governs the entries a worker wrote before the merge.
- Suggestion: step 2 names the mode: settle the notes as the merge settled the open entries (its `- Tickets from findings:` or `- Deferred (client summary):` lines say which), one more line in delivery's procedure; the findings plugin itself unchanged.
- Status: ticket AR0267

## F2. The coordinator's role names `arthur findings`, which a config without the findings plugin no longer has

- Kind: cleanup
- Found by: AR0263 worker (worker), 2026-10-21
- Where: `packages/orchestration/roles/coordinator.md:21`
- What: `/findings` moved from orchestration, which every config holds, to the optional findings plugin. The role still says `arthur board`, `arthur task <id>` and `arthur findings <id>` show the board; without the plugin the last answers `arthur: unknown command findings`.
- Suggestion: either keep the line (Arthur's own config loads findings) and say so in a word, or let the findings plugin add its line to the coordinator's context through `coordinator.context`; nothing else changes.
- Status: ticket AR0268

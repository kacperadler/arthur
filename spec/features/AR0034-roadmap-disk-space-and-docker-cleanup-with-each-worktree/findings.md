# AR0034 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. AR0003 names `arthur merge` as roadmap entry 53; it is entry 54

- Kind: cleanup
- Found by: 2026-10-16-ar0034-disk-and-docker-c-1cb169d7 (worker), 2026-10-16
- Where: `spec/features/AR0003-merge-checks-of-a-project-that-requires-another-os-run-on-local/ticket.md:22`, `:27`, `:33`
- What: AR0003's Evidence, Done means and Scope say "entry 53 (`arthur merge`)" and "Add it to entry 53's Delivers and Done means". In `spec/roadmap.md`, entry 53 is `arthur review-needed` and `arthur merge` is entry 54 (AR0002's own Decision says 54). A worker following AR0003 literally edits the wrong entry.
- Suggestion: change the three mentions in AR0003 to entry 54. Nothing else; AR0034 kept entries 1 to 68 at their numbers, so the fix stays valid.
- Status: dropped: AR0003 is dropped (folded into roadmap entry 54 by AR0002), so it is never built; AR0037 dropped

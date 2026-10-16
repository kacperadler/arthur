# AR0002 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Merge checks of a project that requires another OS run on `local`

- Kind: risk
- Found by: 2026-10-16-ar0002-roadmap-job-state-a365c361 (worker), 2026-10-16
- Where: `spec/roadmap.md`, entry 53 (`arthur merge`) and entry 31 (placement by labels)
- What: entry 31 places every job of a ticket by its labels, so an iOS project's worker and review run on the Mac. Entry 53 still runs install and the project's checks in the main checkout, on `local` (Linux in the example). For a project with `requires: { os: "macos" }` those checks cannot pass there, and a failed check resets main, so such a project can never merge through `arthur merge`.
- Suggestion: decide where a merge's checks run for a project whose `requires` excludes `local`: on a machine with the labels (the merged tree pushed there over SSH, as entry 21 pushes a base commit), or only in CI (`ci.workflow`, with `arthur merge --auto` as the gate). Add it to entry 53's Delivers and Done means; the merge itself stays on `local`.
- Status: ticket AR0003

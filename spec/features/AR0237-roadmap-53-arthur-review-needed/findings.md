# AR0237 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A review with no verdict still shows `finished` in the core's job record

## F1. A check run moved to the background gets no line in `checks`

- Kind: gap
- Found by: 2026-10-20-ar0237-roadmap-53-review-bbeeea77 (worker), 2026-10-20
- Where: `packages/delivery` checks extension
- What: a test run the bash tool backgrounds (after roughly 35 to 65 s) records nothing, so a small branch with a long suite answers `review`.
- Status: dropped (documented in the command doc; errs toward more reviews, never fewer)

## F2. An edit through bash does not mark the checks `stale`

- Kind: gap
- Found by: 2026-10-20-ar0237-roadmap-53-review-bbeeea77 (worker), 2026-10-20
- Where: `packages/delivery` checks extension
- What: only the edit and write tools mark `stale`; `sed -i` or `git checkout` through bash does not.
- Status: dropped (documented in the command doc; review-needed also reads the diff, and the reviewer runs the checks)

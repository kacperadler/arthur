# AR0098 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. arthur.mmd shows project agents in the first version, and orchestration as 1 of 8 entries built

- Kind: cleanup
- Found by: 2026-10-17-ar0098-project-agents-160d388f (worker), 2026-10-18
- Where: `arthur.mmd:49-54` and `:3`, its copy in `README.md`, and `README.md:63`
- What: the roadmap now places project agents (85 to 88) first among the later entries, but `arthur.mmd` draws the `agents` box inside "First-version plugins", in the Coordinator group. The same diagram and the README's feature table still say orchestration has entry 23 of 8 built ("1 of 8 entries", "23 built; 24 to 29, 65"), though AR0084 (entry 24) and AR0110 (entry 26) are merged.
- Suggestion: move `agents` into "Later plugins" (first in its row), refresh the built counts and the legend's date from `spec/build.json`, and copy `arthur.mmd` into the README block (the structure test checks they match). Leave the roadmap alone.
- Status: ticket AR0115

## F2. The vision's orchestration row gained project agents without the plan listing it

- Kind: cleanup
- Found by: 2026-10-17-review-ar0098-project-ag-cb647b22 (review), 2026-10-18
- Where: `spec/vision.md:34`
- Status: dropped (consistent with option B and the roadmap's entries 85 to 88)

## F3. The vision's plugin table lists findings after nvm

- Kind: cleanup
- Found by: 2026-10-17-review-ar0098-project-ag-cb647b22 (review), 2026-10-18
- Where: `spec/vision.md:72-73`
- Status: dropped (cosmetic; the table is not in roadmap order elsewhere either)

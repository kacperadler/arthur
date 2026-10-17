# AR0101 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The vision and the core-and-plugins diagram miss the `findings` and `nvm` plugins

- Kind: cleanup
- Found by: 2026-10-17-ar0101-diagram-fb43a273 (worker), 2026-10-17
- Where: `spec/vision.md:64` (the plugin table), `docs/architecture/core-and-plugins.mmd`
- What: the roadmap plans a `findings` plugin (entry 83) and an `nvm` plugin (entry 84), both outside its Later section. The vision's plugin table names `nvm` but not `findings`. `docs/architecture/core-and-plugins.mmd` names neither. `arthur.mmd` shows both, so the three pictures of the plugin list disagree. AR0064 closed the same gap for `models`.
- Suggestion: add a `findings` row to the vision's plugin table, and `nvm` and `findings` boxes to `core-and-plugins.mmd`. Leave the roadmap as it is.
- Status: ticket AR0102 (dropped 2026-10-17: folded into AR0098, which edits the vision and core-and-plugins.mmd)

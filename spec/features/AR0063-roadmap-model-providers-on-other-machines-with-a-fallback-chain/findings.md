# AR0063 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The `models` plugin is missing from the vision and the architecture diagrams

- Kind: cleanup
- Found by: 2026-10-16-ar0063-providers-and-fal-c8dd47f8 (worker), 2026-10-16
- Where: `spec/vision.md:74`, `docs/architecture/versions.mmd:9`, `docs/architecture/core-and-plugins.mmd:15`
- What: roadmap entry 82 and `arthur.config.example.ts` add a `models` plugin (marked `first, named`), but the vision's plugin table and both diagrams list every plugin except it; voice (81) was added to all three. This ticket's Scope names only the roadmap and the example config.
- Suggestion: one row in the vision's table (`models (named) | first | Models served on the owner's machines, and an ordered fallback per role or kind`), and `models` in the first-version box of `versions.mmd` and in `core-and-plugins.mmd` with its `first` class. Nothing else.
- Status: ticket AR0064

# AR0236 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A rerun keeps its run id, so its end is never told as `ci-finished`

- Kind: risk
- Found by: 2026-10-20-ar0236-roadmap-57-github-6bafb88c (worker), 2026-10-20
- Where: `packages/github/src/github.ts` (`finished`, the ids told), `spec/roadmap.md` entry 58
- What: entry 57 tells `ci-finished` once per run id, as its Delivers and the vision say. GitHub's rerun ("Re-run a workflow", entry 58's `--rerun`) keeps the run's `id` and raises its `run_attempt`, so once a run was told, the end of its rerun is taken as told and the coordinator never hears it [INFERENCE: from GitHub's documented `run_attempt` field; no rerun was exercised].
- Suggestion: when entry 58 builds `--rerun`, key what is told by `<id>/<run_attempt>` (the state file's ids become those keys) and test a rerun's end told once; entry 57's "once per run id" then reads "once per run attempt".
- Status: open

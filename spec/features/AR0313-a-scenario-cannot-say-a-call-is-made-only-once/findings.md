# AR0313 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The baseline of delivery/check-failed predates its stricter expectations

- Kind: cleanup
- Found by: 2026-10-23-ar0313-301b4366 (worker), 2026-10-23
- Where: `evals/baseline.json:2`
- What: AR0313 made `packages/delivery/evals/check-failed/scenario.json` stricter: the `arthur continue` that names the failing test must be made exactly once (`"times": 1`), and any other `arthur continue` is in `never`. The baseline's 2/3 was measured by AR0312 on the scenario before that, so a run that continued twice counted as a pass there and fails now; a lower rate on the next eval would read as a regression of the coordinator when it is a change of the scenario. No real-model eval ran in AR0313.
- Suggestion: run `arthur eval delivery/check-failed --save-baseline` with the coordinator's own model and commit the new rate, as AR0312 did; nothing else changes.
- Status: open

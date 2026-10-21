# AR0257 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A waiting branch's run that ended before github's first poll of its project wakes nobody

- Kind: risk
- Found by: 2026-10-21-ar0257-one-wake-per-ci-e-86ffbf6f (worker), 2026-10-21
- Where: `packages/github/src/github.ts:75` (a project's first poll takes every finished run as told), `packages/delivery/src/ci-wait.ts` (`ciEnded`, now the only wake of a waiting branch's run end)
- What: since AR0257, a CI wait's run end reaches the coordinator only through github's poll asking `delivery.ciEnded`. A project's first poll, with nothing for it in `.arthur/github/state.json` (github never polled it, or the file is broken or hand-edited), emits no `ci-finished` for runs already finished, so a wait whose run ended before that poll is never woken on; before AR0257 delivery's own poll told it. [INFERENCE] from reading the lines; no test runs that order.
- Suggestion: on a project's first poll, still ask `delivery.ciEnded` for the in-play branches whose run finished (without emitting `ci-finished` or github's own wake), so a waiting branch is told and nothing else changes.
- Status: open

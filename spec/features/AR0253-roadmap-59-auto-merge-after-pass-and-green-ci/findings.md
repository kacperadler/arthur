# AR0253 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A waiting branch's CI end wakes the coordinator twice

- Kind: improvement
- Found by: 2026-10-21-ar0253-roadmap-59-auto-m-df78fc6b (worker), 2026-10-21
- Where: `packages/github/src/github.ts:90` (the `ci-finished` wake) and `packages/delivery/src/ci-wait.ts` (the CI wait's wake)
- What: with github's default `wakeOn: ["ci-finished"]`, the end of a run on a branch that `arthur merge --auto` left waiting brings two `coordinator-message`s: github's `[github] CI run … ended …` and delivery's `[delivery] CI passed on … arthur merge --auto <job>` (or `CI ended …`). [INFERENCE] from reading both wakes; no test runs both plugins together, as a plugin is tested against the fake host alone.
- Suggestion: one wake per run end: for example github leaves out its wake for a branch whose job delivery says waits (a provided name such as `delivery.waiting`), or delivery's wake is the only one for those branches; decide which plugin owns it. Nothing else changes.
- Status: open

## F2. The coordinator's role names merges only on the owner's word

- Kind: improvement
- Found by: 2026-10-21-ar0253-roadmap-59-auto-m-df78fc6b (worker), 2026-10-21
- Where: `packages/orchestration/roles/coordinator.md:25`
- What: the role says `When the owner asks for a merge: arthur merge <job>`; `arthur merge --auto` is told to the coordinator only by delivery's wakes (a PASS in a project with `autoMerge` on, and a waiting branch's CI end). A coordinator that reads its role as the only rule for merges may wait for the owner anyway.
- Suggestion: one line in that bullet: in a project with `autoMerge` on, after a PASS the wake names `arthur merge --auto <job>`; a refusal that says `it waits` needs nothing until CI's wake. Out of AR0253's Scope (orchestration), so left here.
- Status: open

# AR0140 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A pre-approved ticket's budget is recorded, not held at its worker's spawn

- Kind: risk
- Found by: 2026-10-18-ar0140-d850a4c7 (worker), 2026-10-18
- Where: `packages/orchestration/src/autopilot.ts`
- What: `arthur ticket status <id> planned --autopilot` checks the budget against `autopilot.budgetMaxUsd` and writes it in the ticket's `Pre-approved by policy: ..., budget $<n> of the $<cap> cap` line, and the coordinator is told to spawn the worker with `--budget <n>`. Nothing checks that it does: `arthur spawn 'Ticket: ...'` without `--budget` takes `core.jobs.budgetUsd` (default 2), `--budget 10` or `--budget 0` (no limit) pass, and `arthur continue --budget` replaces it, so a pre-approved job can spend past the cap without the owner's word.
- Suggestion: a `beforeSpawn` of orchestration (beside `unapproved` in plans.ts) that refuses a worker, and a continue, on a ticket whose `ticket.md` at HEAD holds a `Pre-approved by policy` line with a `budgetUsd` of 0 or above that line's budget, naming it; an owner's own approval after it (a Decisions line the owner writes) lifts it. Out: the per-feature caps of the resources plugin, which already sum a ticket's spend.
- Status: open

## F2. Two `--autopilot` runs on one ticket at once can both record it

- Kind: bug
- Found by: 2026-10-18-ar0140-d850a4c7 (worker), 2026-10-18
- Where: `packages/orchestration/src/autopilot.ts`
- What: the status check, the write of the `Pre-approved by policy` line and the move are not one step under the board's lock: two processes running `arthur ticket status <id> planned --autopilot` at the same moment both see `planning`, both append a line, and the second move is a move to the same status. The ticket ends planned with two records. One coordinator runs its commands one after another, so it needs two writers [INFERENCE: not reproduced].
- Suggestion: take a lock per ticket (a file created with `wx` in the board's `spec/.board/`) around check, write and move, or let `host.board.move` take a change of the ticket's text that it writes under its own lock.
- Status: open

## F3. `--autopilot` does not read a ticket's own budget

- Kind: improvement
- Found by: 2026-10-18-ar0140-d850a4c7 (worker), 2026-10-18
- Where: `packages/orchestration/src/autopilot.ts`
- What: the harness Arthur replaces copies a finding's `- Budget:` into the ticket's JSON block as `budget`, and its `ticket status --autopilot` passes it as `--budget`. Arthur's takes `--budget`, else `autopilot.budgetUsd`, so a finding expected to cost more than the default needs the coordinator to read and pass it by hand.
- Suggestion: when the findings plugin (roadmap 83) writes a `budget` key into a ticket's JSON block, `--autopilot` takes it when `--budget` is left out, still capped at `autopilot.budgetMaxUsd`.
- Status: open

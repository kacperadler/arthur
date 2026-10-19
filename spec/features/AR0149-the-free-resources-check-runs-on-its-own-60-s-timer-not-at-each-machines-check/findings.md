# AR0149 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. With check.everySeconds above 120 a spawn between rounds still checks a listed machine over ssh itself

- Kind: improvement
- Found by: 2026-10-19-ar0149-resources-pair-f2e0e6b4 (worker), 2026-10-19
- Where: `packages/resources/src/room.ts` (`fresh`, `2 * CHECK_SECONDS`)
- What: a listed machine's free CPU and memory now come with each `machines` round (`machines.round`), but `fresh` still counts a check older than 120 s as stale. With `machines`' `check.everySeconds: 300`, a spawn, placement or `arthur resources` 2 to 5 minutes after a round runs the resources plugin's own `node -e` over ssh to that machine, a second ssh call between rounds.
- Suggestion: carry the round's cadence in `machines.round` (or keep it with the sample), so a sample a round kept counts fresh until twice `check.everySeconds`; the on-demand check stays for a missing sample and for processes without rounds (`arthur spawn`, `arthur resources` from a shell). Out: how the room is computed.
- Status: open

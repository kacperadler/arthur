# AR0300 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The agent's extensions still append to `log` with a flag that creates it

- Kind: bug
- Found by: 2026-10-22-ar0300-f1036105 (worker), 2026-10-22
- Where: `packages/core/src/steer.ts:29`, `packages/core/src/worktree-guard.ts:170`
- What: AR0300 makes the wrapper append to `log` without creating it, but the steer extension (a steer delivered at a `tool_result`) and the worktree guard (its once-per-job fallback line) run in the agent's process and append with `appendFileSync`'s default flag `a`, which creates `log`; one that lands while a `rm -r` of the record is emptying it, after `log` was unlinked, leaves a new `log` and the `rm -r` fails with `ENOTEMPTY`. [INFERENCE: read from the lines; not reproduced.]
- Suggestion: append there with `{ flag: constants.O_WRONLY | constants.O_APPEND }` as `wrapper.ts` does and skip the line on `ENOENT` (the wrapper ends the job at its next use); out: any retry of the append.
- Status: open

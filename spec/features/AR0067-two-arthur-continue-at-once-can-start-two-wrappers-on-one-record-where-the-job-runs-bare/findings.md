# AR0067 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. An `arthur continue` killed before its wrapper starts leaves `continuing`, and the job is never continued again

- Kind: risk
- Found by: 2026-10-16-ar0067-one-continue-at-a-52c02319 (worker), 2026-10-16
- Where: `packages/core/src/job-control.ts` (`continueJob`, its `finally`)
- What: `continueJob` creates `<record>/continuing` before it reads the state and removes it in a `finally` when the continue fails; the new wrapper removes it once running. A process ended by a signal skips the `finally`: a Node process waiting in `try { await … } finally { … }` exited 130 on SIGINT without running its `finally` (run on 2026-10-16). So a Ctrl-C, or a SIGKILL, of `arthur continue` while it runs the plugins' `beforeSpawn` checks, waits for the old wrapper (up to 5 seconds), or waits for the new wrapper's `pid` (up to 10 seconds) leaves `continuing`, and every later continue of that job is refused `<id>: being continued` until the folder is removed by hand (said in `packages/core/docs/commands/continue.md`).
- Status: open

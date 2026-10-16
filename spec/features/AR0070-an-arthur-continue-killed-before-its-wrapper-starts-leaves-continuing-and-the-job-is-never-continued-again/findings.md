# AR0070 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A continue killed between its new wrapper's `pid` and `state` lets a second continue start beside the running wrapper

- Kind: risk
- Found by: 2026-10-16-ar0070-continue-killed-b-771a00d8 (worker), 2026-10-16
- Where: `packages/core/src/wrapper.ts:94-96`, `packages/core/src/job-control.ts` (`continueJob`)
- What: the new wrapper writes `pid`, then `state` (`running`), then removes `continuing`. `continueJob` now waits after `launch` until the state says `running` (or the wrapper is gone) before its process ends, so a continue that ends normally never leaves its lock to be taken over while the record still shows the old final state. A continue killed (SIGKILL, Ctrl-C) inside the moment between the wrapper's two writes still does: the next continue takes the dead holder's `continuing` over, reads the old final state, waits up to 5 seconds for the new wrapper (which keeps running), removes its `pid` and launches a second wrapper in the scope of the same name. [INFERENCE, not run: the window is the time between two synchronous renames] `systemd-run` then refuses the scope and `launch` writes `failed` over the job the first wrapper is running.
- Suggestion: let the wrapper write `state` before `pid` only if the dead-job sweep in `job-records.ts` (which ends a `running` record whose wrapper pid is not running) tolerates a moment without `pid`; or let a continue that took `continuing` over refuse when `pid` names a live wrapper of the job newer than the record's `continue`. Out: anything beyond `continueJob`, `wrapper.ts` and the sweep.
- Status: open

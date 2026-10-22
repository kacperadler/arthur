# AR0281 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The decision log's race test catches a missing lock only in most runs

- Kind: improvement
- Found by: 2026-10-22-ar0281-decision-log-fa71d0e0 (worker), 2026-10-22
- Where: `packages/orchestration/test/decisions.test.ts` ("asks at once, from four processes asking five times each")
- What: with `withLock` taken out of `change` in `packages/orchestration/src/decision-log.ts`, the test failed in 2 of 3 runs (a throwaway mutation run on this branch): four processes asking five times each collide only when two land inside one read-and-rename window. With the lock it passes every time.
- Suggestion: a deterministic test: hold `<home>/orchestration/decisions-<project>.lock` from a child process with `takeLock`, start `arthur decision ask`, release, and assert the ask waited for the release (its record after a marker the holder wrote); leave the four-process test as it is.
- Status: open

## F2. A job's question and the plugin's closes take the log's lock synchronously inside `arthur run`

- Kind: risk
- Found by: 2026-10-22-ar0281-decision-log-fa71d0e0 (worker), 2026-10-22
- Where: `packages/orchestration/src/decision-log.ts` (`change`, `withLock`), called from the `job-state` and `ticket-moved` handlers in `decision-hooks.ts` and `blocked-notice.ts`
- What: `withLock` waits by blocking the process, up to 10 s, then throws. While an `arthur decision` in another process holds the lock (milliseconds normally), `arthur run`'s event loop stalls in the handler; a holder that hangs stalls it 10 s and costs that question its record (the notice goes without its id). [INFERENCE] from the lock's code; not reproduced.
- Suggestion: take the lock with `queueLock` in the plugin's own handlers (the notice emitted after the ask resolves), keeping `withLock` for the commands.
- Status: open

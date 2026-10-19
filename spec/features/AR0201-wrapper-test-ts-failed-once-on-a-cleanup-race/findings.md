# AR0201 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A record removed file by file crashes the wrapper instead of ending it with its one line

- Kind: bug
- Found by: 2026-10-19-ar0201-wrapper-flake-ecce772d (worker), 2026-10-19
- Where: `packages/core/src/wrapper.ts:40-47`
- What: `guard` calls `leave()` only once the record's folder is gone; a use that fails while the folder still exists but its files are not (a `rm -r` in progress, which unlinks the files before the folder) rethrows, and the wrapper dies on the uncaught error with a stack trace in `wrapper.log`, no `leave()`: the agent is not sent SIGTERM by it and the one line is not written. Seen with a throwaway probe in `wrapper.test.ts` (the record's files unlinked, the folder kept for 1 s while the agent wrote to stderr): `wrapper.log` held `Error: ENOENT: no such file or directory, utime '<record>/active'` thrown from `wrapper.ts:44`. Its `appendFileSync` of the agent's output into `log` in that window also recreates `log`, so a human's `rm -r` of a running job's record can fail with `ENOTEMPTY`.
- Suggestion: treat a failed use whose record lacks a file the wrapper itself wrote at its start (`pid`) as the record being deleted, and `leave()`; out: any retry of the use.
- Status: open

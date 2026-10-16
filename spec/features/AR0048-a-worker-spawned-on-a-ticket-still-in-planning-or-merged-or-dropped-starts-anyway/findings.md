# AR0048 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A ticket moved to merged or dropped during a spawn still gets its worker

- Kind: risk
- Found by: 2026-10-16-ar0048-refuse-spawn-on-u-b2cbf1cc (worker), 2026-10-16
- Where: `packages/core/src/host.ts` (the core `beforeSpawn` check and the `job-started` handler)
- What: the core's `beforeSpawn` reads the ticket's status, then the worktree, the node_modules copy and every `prepare` run, and only `job-started` moves the ticket to in-progress. An `arthur ticket` move to `planning`, `merged` or `dropped` in that window passes the check, and the move at `job-started` fails with the old stderr line `plugin core: handler of job-started (event N) failed: ...` while the job exists. [INFERENCE] from the order of the lines in `packages/core/src/jobs.ts` `spawn`; not reproduced, the window needs a second writer during a spawn.
- Suggestion: move the ticket to in-progress inside the spawn, under the board's lock, before the worktree exists, and move it back (or leave it, decided in the ticket) when a later step removes the job; this touches `jobs.ts`, which AR0014 changes, so it was kept out of AR0048.
- Status: open

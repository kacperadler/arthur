# AR0024 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A job on another machine gets this host's joint CPU and memory limit

- Kind: risk
- Found by: 2026-10-16-ar0024-jobs-on-another-m-bc3c12f4 (worker), 2026-10-16
- Where: `packages/core/src/job-machine.ts` (`launchThere`), `packages/core/src/remote-job.ts` (`launch`)
- What: `arthur remote-job launch` sets the slice there to this config's `core.jobs.cpu` and `core.jobs.memory`. `cpu` defaults to this host's cores minus one, so on a machine with fewer cores the quota is above what it has (no limit), and on one with more it holds jobs below it. `memory` as a percentage is fine; an absolute one (`8G`) is this host's figure.
- Suggestion: let the machine's own defaults apply there (its cores minus one, `70%`), or take the limits from the machine's registration once resources (entries 32 to 34) give each machine its own; leave the per-job caps to those entries.
- Status: open

## F2. Each sweep copies a job's whole `log` from another machine whenever it grew

- Kind: improvement
- Found by: 2026-10-16-ar0024-jobs-on-another-m-bc3c12f4 (worker), 2026-10-16
- Where: `packages/core/src/remote-job.ts` (`records`), `packages/core/src/job-machine.ts` (`syncMachine`)
- What: the copy sends every changed file whole. A long run's `log` (one line per tool call plus the agent's stderr) grows to megabytes and goes over SSH again every 30 s while the job is active, then is compared and rewritten here.
- Suggestion: ask for `log` from the size already copied (an offset per job, like `synced`) and append; keep whole files for the rest, which are small.
- Status: open

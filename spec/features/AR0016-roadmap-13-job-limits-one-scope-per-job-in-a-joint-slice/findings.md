# AR0016 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A `systemd-run` that fails after the slice was set leaves a job that never ends

- Kind: risk
- Found by: 2026-10-16-ar0016-one-scope-per-job-d48b552c (worker), 2026-10-16
- Where: `packages/core/src/job-scope.ts`, `launch`
- What: `launch` decides between a scope and a bare job by whether `systemctl --user set-property` succeeds, then starts the wrapper through `systemd-run --user --scope` in the background. When `systemd-run` itself fails after that (missing while `systemctl` is there, or the manager refusing the scope), its message goes to `<home>/wrapper.log`, the wrapper never runs, and the record keeps no `state`: the job neither runs nor ends, and no `job-ended` is emitted. Not reproduced; read from the lines.
- Suggestion: entry 15's sweep of dead jobs (`process gone`) should cover a record with no `pid` and no `state` some time after `job-started`; alternatively `launch` could wait for `systemd-run`'s exit when it is not 0 within a short time and start the wrapper bare with the log line. Out: changing how the slice is set.
- Status: ticket AR0056

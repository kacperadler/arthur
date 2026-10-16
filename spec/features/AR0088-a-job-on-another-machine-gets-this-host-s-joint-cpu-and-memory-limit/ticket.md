# AR0088 - A job on another machine gets this host's joint CPU and memory limit

```json
{
  "id": "AR0088",
  "title": "A job on another machine gets this host's joint CPU and memory limit",
  "date": "2026-10-16"
}
```

## Description

`arthur remote-job launch` sets the slice there to this config's `core.jobs.cpu` and `core.jobs.memory`. `cpu` defaults to this host's cores minus one, so on a machine with fewer cores the quota is above what it has (no limit), and on one with more it holds jobs below it. `memory` as a percentage is fine; an absolute one (`8G`) is this host's figure.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `packages/core/src/job-machine.ts` (`launchThere`), `packages/core/src/remote-job.ts` (`launch`)
- Found by: 2026-10-16-ar0024-jobs-on-another-m-bc3c12f4 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: let the machine's own defaults apply there (its cores minus one, `70%`), or take the limits from the machine's registration once resources (entries 32 to 34) give each machine its own; leave the per-job caps to those entries.
- `npm test` and `npm run check` pass.

## Scope

In:
- let the machine's own defaults apply there (its cores minus one, `70%`), or take the limits from the machine's registration once resources (entries 32 to 34) give each machine its own; leave the per-job caps to those entries.

## Decisions

- 2026-10-16: Source: F1 of AR0024

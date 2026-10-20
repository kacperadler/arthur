# AR0235 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A review with no verdict still shows `finished` in the core's job record

- Kind: improvement
- Found by: 2026-10-20-ar0235-roadmap-52-review-dcf379fb (worker), 2026-10-20
- Where: `packages/delivery/src/delivery.ts` (`wake`), `packages/delivery/src/review-records.ts` (`settle`)
- What: entry 52 says no verdict fails the job. With the host API frozen (entry 51) a plugin cannot change how a run ended, so delivery fails the review on its side: no ticket move, the wake says the review failed, `arthur ticket file` refuses it, and its record keeps `none`. The core's record, `arthur jobs` and `job-ended` still say `ended (finished)`, as the harness's `failed: no verdict` did not.
- Suggestion: if `arthur jobs` must show it, a host member that lets a kind judge its run's outcome before `state` is written (for example `Kind.outcome(result)` returning a failure reason), decided in its ticket as an API change; nothing else changes in delivery.
- Status: fixed in 74f8c7a

## F2. A review placed on another machine needs the worker's commit there

- Kind: risk
- Found by: 2026-10-20-ar0235-roadmap-52-review-dcf379fb (worker), 2026-10-20
- Where: `packages/delivery/src/delivery.ts` (the `prepare` step)
- What: the review's checkout of the branch's tip runs on the review's machine. A worker that ran on the same machine left its commits in the repository there, so a review of an `os=macos` ticket after a worker on the Mac checks out. A worker that ran elsewhere (here, or before the ticket got its labels) did not, and the review's spawn is refused: `plugin delivery: prepare failed: arthur/<id> at <commit> cannot be checked out on machine mac: ...`. The core pushes only the base commit to another machine, and the host API gives a plugin no machine's `ssh` or `home` to push one itself.
- Suggestion: the core pushes a spawn's extra commit too (for example `SpawnRequest.fetch: commit`), next to `refs/arthur/base`; an API change, decided in its ticket.
- Status: fixed in 74f8c7a

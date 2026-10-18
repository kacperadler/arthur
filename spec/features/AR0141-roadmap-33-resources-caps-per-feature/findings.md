# AR0141 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. A continued job sets its ticket's slice from the caps kept at its spawn

- Kind: risk
- Found by: 2026-10-18-ar0141-99f8f735 (worker), 2026-10-18
- Where: `packages/core/src/job-scope.ts:40-43`
- What: `launch` sets the ticket slice's `CPUQuota` and `MemoryMax` from the job's record (`feature-cpu`, `feature-memory`), written at its spawn. After the human raises a ticket's `cpu` or `memory` cap, a new spawn sets the new values, but `arthur continue` of an older job of the same ticket sets the old ones back on the slice all its jobs share. [INFERENCE: from the lines, not run.]
- Suggestion: have `continueJob` ask `jobs.limits` again and rewrite the record's caps before `launch`.
- Status: ticket AR0145

## F2. Caps per feature on CPU and memory are not held, and not said, on a machine without a user manager

- Kind: improvement
- Found by: 2026-10-18-ar0141-99f8f735 (worker), 2026-10-18
- Where: `packages/core/src/job-scope.ts:44-48`
- What: a job that runs bare (macOS, a container) has no ticket slice; the once-per-machine `notice` names only a job's own caps. Documented in `packages/resources/docs/resources.md`, not told.
- Suggestion: extend the notice's condition and text to a job with `feature` caps.
- Status: ticket AR0146

## F3. A ticket over its memory cap ends a job `failed: the agent was killed by ...`, not `limit: memory`

- Kind: improvement
- Found by: 2026-10-18-ar0141-99f8f735 (worker), 2026-10-18
- Where: `packages/core/src/job-memory.ts:15-40`
- What: the wrapper watches only its own scope's `memory.events`; an OOM kill from the ticket slice's `MemoryMax` reaches the job as a killed agent. [INFERENCE: from the lines, not run.]
- Suggestion: also read the parent slice's `memory.events` when the record names a `feature`.
- Status: ticket AR0147

# AR0145 - A continued job sets its ticket's slice from the caps kept at its spawn

```json
{
  "id": "AR0145",
  "title": "A continued job sets its ticket's slice from the caps kept at its spawn",
  "date": "2026-10-18"
}
```

## Description

`launch` sets the ticket slice's `CPUQuota` and `MemoryMax` from the job's record (`feature-cpu`, `feature-memory`), written at its spawn. After the human raises a ticket's `cpu` or `memory` cap, a new spawn sets the new values, but `arthur continue` of an older job of the same ticket sets the old ones back on the slice all its jobs share. [INFERENCE: from the lines, not run.]

## Goal

A job continued after its ticket's caps changed is held to the caps in force now, not the ones from its spawn.

- Kind: risk

Evidence:
- `packages/core/src/job-scope.ts:40-43`
- Found by: 2026-10-18-ar0141-99f8f735 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: have `continueJob` ask `jobs.limits` again and rewrite the record's caps before `launch`.
- `npm test` and `npm run check` pass.

## Scope

In:
- have `continueJob` ask `jobs.limits` again and rewrite the record's caps before `launch`.

## Decisions

- 2026-10-18: Source: F1 of AR0141
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
- 2026-10-19: The owner asked for small findings to be built in batches by 2 workers while 1 builds the roadmap. This ticket hosts the resources batch: AR0145, AR0146, AR0147, AR0149, AR0150, AR0171, built and merged together.

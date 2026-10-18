# AR0147 - A ticket over its memory cap ends a job `failed: the agent was killed by ...`, not `limit: memory`

```json
{
  "id": "AR0147",
  "title": "A ticket over its memory cap ends a job `failed: the agent was killed by ...`, not `limit: memory`",
  "date": "2026-10-18"
}
```

## Description

the wrapper watches only its own scope's `memory.events`; an OOM kill from the ticket slice's `MemoryMax` reaches the job as a killed agent. [INFERENCE: from the lines, not run.]

## Goal

A ticket that goes over its memory cap ends its job with `limit: memory`, so the owner sees why it stopped.

- Kind: improvement

Evidence:
- `packages/core/src/job-memory.ts:15-40`
- Found by: 2026-10-18-ar0141-99f8f735 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: also read the parent slice's `memory.events` when the record names a `feature`.
- `npm test` and `npm run check` pass.

## Scope

In:
- also read the parent slice's `memory.events` when the record names a `feature`.

## Decisions

- 2026-10-18: Source: F3 of AR0141

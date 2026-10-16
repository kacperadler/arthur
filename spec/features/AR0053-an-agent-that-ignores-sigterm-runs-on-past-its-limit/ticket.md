# AR0053 - An agent that ignores SIGTERM runs on past its limit

```json
{
  "id": "AR0053",
  "title": "An agent that ignores SIGTERM runs on past its limit",
  "date": "2026-10-16",
  "after": [
    "AR0017"
  ]
}
```

## Description

a job at its time or budget limit gets SIGTERM to its process group and nothing more. An agent (or a tool process it waits on) that ignores SIGTERM keeps running, and spending, until it ends on its own; the record says `limit: time` or `limit: budget` only then. Reproduced in `packages/core/test/limits.test.ts`, "a job whose time runs out while it stops at its budget is not resumed": its agent runs `trap '' TERM` and goes on until the test writes its `go` file.

## Goal

A limit really ends a job: an agent or tool that ignores SIGTERM cannot run on and keep spending past its time or budget.

- Kind: risk

Evidence:
- `packages/core/src/wrapper.ts` (`stopAgent`)
- Found by: 2026-10-16-ar0015-job-limits-time-a-b27f47ad (worker), 2026-10-16

## Done means

- A job at its limit gets SIGTERM to its process group and, if any process of the group is still alive after a grace (the same grace and the same stop function entry 14's `arthur stop` uses), SIGKILL to the group; the record says the limit as soon as the job ends.
- The test with `trap '' TERM` ends by itself within the grace plus a second, without the `go` file.
- `npm test` and `npm run check` pass.

## Scope

In:
- The stop of entry 14 (AR0017), reused by the limits; `wrapper.ts`, `limits.test.ts`.

## Decisions

- 2026-10-16: Source: F1 of AR0015
- 2026-10-16: Coordinator: built together with entry 14's stop (AR0017), so there is one stop with one grace.

# AR0068 - A continued worker leaves its ticket in review or done

```json
{
  "id": "AR0068",
  "title": "A continued worker leaves its ticket in review or done",
  "date": "2026-10-16",
  "after": [
    "AR0018"
  ]
}
```

## Description

the core moves a worker's tickets to in-progress on `job-started`, which only a spawn emits; `continueJob` emits none. Since AR0065 the core's `beforeSpawn` lets a continue through on a ticket in `review` or `done` (as a spawn), but the ticket then stays in `review` or `done` while the worker runs again. [INFERENCE: from those lines; not run.]

## Goal

The board says what is happening: a worker continued on a ticket in review or done moves it back to in-progress, as the harness does.

- Kind: bug

Evidence:
- `packages/core/src/job-control.ts` (`continueJob`), `packages/core/src/board-jobs.ts` (`moveStartedTickets`)
- Found by: 2026-10-16-ar0065-continue-runs-bef-39824cd9 (worker), 2026-10-16

## Done means

- A continue of a worker moves each ticket its task names to in-progress, through the same core move a spawn uses (emit `job-started` for the continued run, or call the move directly; the worker says which and why); read-only kinds move nothing.
- A test: a worker's ticket at `review` is continued and ends at `in-progress` with one `ticket-moved`; at `in-progress` nothing is written.
- `npm test` and `npm run check` pass. No core budget raise: move or cut lines to fit.

## Scope

In:
- `packages/core/src/job-control.ts`, `board-jobs.ts`, their tests.

## Decisions

- 2026-10-16: Source: F1 of AR0065

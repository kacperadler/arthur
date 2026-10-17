# AR0112 - A turn that keeps failing is handed its messages again every second, without a pause

```json
{
  "id": "AR0112",
  "title": "A turn that keeps failing is handed its messages again every second, without a pause",
  "date": "2026-10-17"
}
```

## Description

a turn that ends in an error or is aborted answers nothing, and its messages go again at the next idle tick (500 ms), as the plan asks. With the model down for good (no credit, a revoked login), or the owner aborting at the pane on purpose, the coordinator starts a failing turn about every second until it works.

## Goal

A coordinator whose turns keep failing waits longer between tries and tells the owner once, instead of retrying every second.

- Kind: risk

Evidence:
- `packages/orchestration/src/inbox-extension.ts` (`agent_end`, `tick`)
- Found by: 2026-10-17-ar0084-inbox-ceecda3e (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: wait longer before each redelivery of the same message (doubling from 5 s, at most 5 min), and tell the owner once by `notice` after a few failed turns. Out: the first redelivery, which stays quick.
- `npm test` and `npm run check` pass.

## Scope

In:
- wait longer before each redelivery of the same message (doubling from 5 s, at most 5 min), and tell the owner once by `notice` after a few failed turns. Out: the first redelivery, which stays quick.

## Decisions

- 2026-10-17: Source: F2 of AR0084

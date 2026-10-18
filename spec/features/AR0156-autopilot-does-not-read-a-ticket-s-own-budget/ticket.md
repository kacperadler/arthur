# AR0156 - `--autopilot` does not read a ticket's own budget

```json
{
  "id": "AR0156",
  "title": "`--autopilot` does not read a ticket's own budget",
  "date": "2026-10-18"
}
```

## Description

the harness Arthur replaces copies a finding's `- Budget:` into the ticket's JSON block as `budget`, and its `ticket status --autopilot` passes it as `--budget`. Arthur's takes `--budget`, else `autopilot.budgetUsd`, so a finding expected to cost more than the default needs the coordinator to read and pass it by hand.

## Goal

A pre-approved ticket's own budget, when it has one, is the one checked and recorded.

- Kind: improvement

Evidence:
- `packages/orchestration/src/autopilot.ts`
- Found by: 2026-10-18-ar0140-d850a4c7 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: when the findings plugin (roadmap 83) writes a `budget` key into a ticket's JSON block, `--autopilot` takes it when `--budget` is left out, still capped at `autopilot.budgetMaxUsd`.
- `npm test` and `npm run check` pass.

## Scope

In:
- when the findings plugin (roadmap 83) writes a `budget` key into a ticket's JSON block, `--autopilot` takes it when `--budget` is left out, still capped at `autopilot.budgetMaxUsd`.

## Decisions

- 2026-10-18: Source: F3 of AR0140

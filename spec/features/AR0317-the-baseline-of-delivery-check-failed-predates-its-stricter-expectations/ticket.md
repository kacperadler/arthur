# AR0317 - The baseline of delivery/check-failed predates its stricter expectations

```json
{
  "id": "AR0317",
  "title": "The baseline of delivery/check-failed predates its stricter expectations",
  "date": "2026-10-23"
}
```

## Description

AR0313 made `packages/delivery/evals/check-failed/scenario.json` stricter: the `arthur continue` that names the failing test must be made exactly once (`"times": 1`), and any other `arthur continue` is in `never`. The baseline's 2/3 was measured by AR0312 on the scenario before that, so a run that continued twice counted as a pass there and fails now; a lower rate on the next eval would read as a regression of the coordinator when it is a change of the scenario. No real-model eval ran in AR0313.

## Goal

`evals/baseline.json` holds `delivery/check-failed` measured on its current, stricter scenario, so a later eval run compares against a true rate.

- Kind: refactor

Evidence:
- `evals/baseline.json:2`
- Found by: 2026-10-23-ar0313-301b4366 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: run `arthur eval delivery/check-failed --save-baseline` with the coordinator's own model and commit the new rate, as AR0312 did; nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- run `arthur eval delivery/check-failed --save-baseline` with the coordinator's own model and commit the new rate, as AR0312 did; nothing else changes.

## Decisions

- 2026-10-23: Source: F1 of AR0313
- 2026-10-23: Coordinator (free hand, finding ticket) approved.

# AR0312 - The eval baseline of delivery/check-failed measures the old scenario

```json
{
  "id": "AR0312",
  "title": "The eval baseline of delivery/check-failed measures the old scenario",
  "date": "2026-10-23"
}
```

## Description

`delivery/check-failed` holds `0/3`, measured when the scenario forbade `arthur continue`. With AR0308's merge.md and scenario, `arthur eval delivery/check-failed --runs 5` passed 5/5 on the agent's default model (no coordinator model configured in the throwaway config), so every later eval reports it `up` against a rate of another scenario.

## Goal

The eval baseline of delivery/check-failed is measured again on the new scenario, so a regression from its pass rate is noticed instead of hidden behind the old 0/3.

- Kind: refactor

Evidence:
- `evals/baseline.json:2`
- Found by: 2026-10-23-ar0308-continue-after-ch-f18c2f31 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: run `arthur eval delivery/check-failed --save-baseline` with the coordinator's own model and commit the new rate.
- `npm test` and `npm run check` pass.

## Scope

In:
- run `arthur eval delivery/check-failed --save-baseline` with the coordinator's own model and commit the new rate.

## Decisions

- 2026-10-23: Source: F1 of AR0308
- 2026-10-23: Coordinator (free hand, finding ticket) approved.

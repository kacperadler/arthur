# AR0580 - Defaults T12: a review starts only on a tip whose check, test and mutate passed

```json
{
  "id": "AR0580",
  "title": "Defaults T12: a review starts only on a tip whose check, test and mutate passed",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T12: P16. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

`tipChecks()` is extracted from `review-needed.ts:79-85`. `arthur review` and the hand-back start a review only when the tip's clean tree has `check pass`, `test pass` and any `mutate` record (named survivors allowed). Otherwise the hand-back continues the worker once with a fixed instruction, and a second miss goes to the coordinator.

- Kind: feat

## Done means

- `review.test.ts`: a tip without each record refused, the one continue, the second miss woken to the coordinator.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (delivery +20), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/review-needed.ts`, `packages/delivery/src/review-command.ts`, `packages/delivery/src/hand-back.ts`, `packages/delivery/docs/commands/review-needed.md`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)

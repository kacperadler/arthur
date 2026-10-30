# AR0582 - Defaults T14: a source line over 160 characters counts as more than one

```json
{
  "id": "AR0582",
  "title": "Defaults T14: a source line over 160 characters counts as more than one",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T14: P19. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

A line counts `max(1, ceil(length/160))` toward the 200-line cap and the package budget, with every budget re-baselined once; the re-baseline is one owner decision (`--kind budget`) asked when the worker has measured it. The styleguide's width clause says so.

- Kind: chore

## Done means

- `structure.test.ts`: a 161-character line counts 2.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (every budget re-baselined, one decision), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `test/structure.test.ts`, `.agents/arthur/criteria/styleguide.md`.

Out:
- Anything of another of the plan's tickets.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)

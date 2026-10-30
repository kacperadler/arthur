# AR0574 - Defaults T6: a passed review's notes reach findings.md by themselves

```json
{
  "id": "AR0574",
  "title": "Defaults T6: a passed review's notes reach findings.md by themselves",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T6: P8 (review notes to findings). The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

`reviewer.md:24` fixes the notes as `## Notes` with `- (<kind>) <file:line>: <title>. <what>` lines. `settleTicket` passes the PASS review's notes in the `findings.onMerge` request; the findings plugin appends those of kind security, bug or risk as entries and settles them in the project's mode.

- Kind: feat

## Done means

- `on-merge.test.ts` and `merge.test.ts`.
- Deleted: `after-merge.md` step 2.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (delivery +8, findings +25), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/roles/reviewer.md`, `packages/delivery/src/merge-outcome.ts`, `packages/findings/src/on-merge.ts`, `packages/findings/docs/findings.md`, `packages/delivery/roles/coordinator/after-merge.md`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- Classifying FAIL findings.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)

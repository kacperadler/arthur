# AR0576 - Defaults T8: a passed review merges by itself in an autoMerge project, and four FAILs come before the owner is asked

```json
{
  "id": "AR0576",
  "title": "Defaults T8: a passed review merges by itself in an autoMerge project, and four FAILs come before the owner is asked",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T8: P7, P14. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

A new `pass-forward.ts` in delivery: on a review PASS (or a `no review` answer) in an `autoMerge` project, it runs `arthur merge --auto <job>` as a child process (the plan's Option 1, the pattern of `orchestration/src/coordinator.ts:17`) and wakes the coordinator once with the merge's output. `LIMIT` in `review-records.ts:14` goes from 2 to 4. Once this merges, the coordinator sets `autoMerge: true` for arthur in `arthur.config.ts` (the owner's word in AR-D345).

- Kind: feat

## Done means

- `review.test.ts`: the child merge on PASS and on `no review`, nothing in a project without `autoMerge`, one wake per refusal and per success; the hand-back rows for rounds 3 and 4.
- Deleted: the `--auto` sentence of the PASS wake (`delivery.ts:163`) and the merge-ask step; the `review-limit.md` trigger text changed.
- The delivery evals' wake text updated.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (delivery +60), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/pass-forward.ts` (new), `packages/delivery/src/delivery.ts`, `packages/delivery/src/review-records.ts`, `packages/delivery/docs/commands/review.md`, `packages/delivery/docs/commands/merge.md`, `packages/delivery/roles/coordinator/review-limit.md`, `packages/delivery/evals/*/scenario.json`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- Making the merge steps async; detecting "tests only" or "the same finding".

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
- 2026-10-30: AR0576 raised to $18 and continued; the owner: "Go with recommendations till 70%" (AR-D394)
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)

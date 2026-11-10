# AR0679 - The go-with-my-recommendation grant and approved policies still answer plan questions, which must go to the owner (AR-D603)

```json
{
  "id": "AR0679",
  "title": "The go-with-my-recommendation grant and approved policies still answer plan questions, which must go to the owner (AR-D603)",
  "date": "2026-11-10"
}
```

## Description

Since AR0665 an answer by the `/silent on ... --recommend` grant or by an approved policy cannot approve a plan, yet both still answer plan questions, so the coordinator asks the owner again anyway. The owner decided (AR-D603) that plan questions always go to him: the grant and policies skip them, as they skip what needs his word.

## Goal

AR0665 finding F2 (`arthur findings AR0665`): `packages/orchestration/src/silent.ts` (`byRecommendation`) and the policy answer still answer a `plan` question, while `packages/orchestration/src/decision-use.ts:47` refuses such an answer for `ticket status ... planned --decision`. Owner, 2026-11-10: "AR-D603 - 1".

- Kind: fix

## Done means

- `arthur decision ask --kind plan ... --recommend` while the grant holds stays open, prints no `answered by recommendation`, and waits for the owner; a test fails before and passes after.
- An approved class whose words match a `plan` question does not answer it; a test fails before and passes after.
- Other kinds keep being answered as today; the existing tests pass.
- `packages/orchestration/docs/commands/decision.md` and `silent.md` say plan questions always go to the owner.

## Scope

In:
- `packages/orchestration/src/silent.ts`, `packages/orchestration/src/decision-classes.ts`, `packages/orchestration/src/decision-writes.ts`: the grant and the classes skip kind `plan`.
- `packages/orchestration/docs/commands/decision.md`, `packages/orchestration/docs/commands/silent.md`.
- Their tests in `packages/orchestration/test/`.

Out:
- What a plan or merge answer must say to count (AR0677).

## Decisions
- 2026-11-10: AR0679 approved; the owner: "AR-D603 - 1" (AR-D606)

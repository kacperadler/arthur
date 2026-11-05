# AR0630 - arthur review runs on a job whose review-needed said no review, and a stopped review then blocks the merge

```json
{
  "id": "AR0630",
  "title": "arthur review runs on a job whose review-needed said no review, and a stopped review then blocks the merge",
  "date": "2026-11-05"
}
```

## Description

`arthur review <worker job>` starts a review even when `arthur review-needed` already answered `no review` for that worker's tip. Once a review of the tip exists, the merge no longer takes the `no review` answer. If that review is stopped, the tip has no verdict and the merge is refused until another review passes. After this change, `arthur review` refuses such a job and says the branch merges without a review, so the coordinator cannot start one by mistake.

## Goal

Evidence, 2026-11-05 01:2x to 02:0x: `arthur review-needed` answered `no review: 26 lines changed` for the AR0624 worker. The coordinator then ran `arthur review` anyway, and stopped that review. `arthur merge --auto` refused with `its review <id> has no verdict`, because `packages/delivery/src/auto-merge.ts:33-34` sets aside the `no review` answer once any review of the tip exists. The merge waited about 30 minutes for a new review to pass.

- Kind: fix

## Done means

- `arthur review <worker job>` refuses, exit 1, when `<folder>/<job>/review-needed` holds `no review` for the branch's current tip (`noReview` in `review-records.ts`). The refusal names the answer and says the branch merges without a review. A test proves the refusal, and another proves that a `no review` kept for an older commit does not refuse.
- A job with a `review` answer, or with no answer at all, is reviewed as today; a test proves it.
- `packages/delivery/docs/commands/review.md` names the refusal.
- The project's checks pass.

## Scope

In:
- `packages/delivery/src/review-command.ts`: the refusal.
- `packages/delivery/test/`: the tests above.
- `packages/delivery/docs/commands/review.md`: the refusal.

Out:
- The merge's rule that a review of the tip outranks `no review` (`auto-merge.ts:34`) stays as it is: a review someone started counts.

## Decisions

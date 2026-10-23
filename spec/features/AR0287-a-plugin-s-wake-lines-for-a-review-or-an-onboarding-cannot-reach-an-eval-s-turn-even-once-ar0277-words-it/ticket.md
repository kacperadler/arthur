# AR0287 - A plugin's wake lines for a review or an onboarding cannot reach an eval's turn, even once AR0277 words it

```json
{
  "id": "AR0287",
  "title": "A plugin's wake lines for a review or an onboarding cannot reach an eval's turn, even once AR0277 words it",
  "date": "2026-10-22"
}
```

## Description

these providers build their line from the job's records in the live home (delivery's review record, the job's result). An eval's job exists in no home, so `review-pass`, `review-pass-hook`, `review-fail-handed-back` and `onboarding-questions` get no verdict line, no `arthur merge --auto` hint, no hand-back line and no `Its questions to send the owner` line. AR0277 (one wording of the turn, from orchestration) would still ask the same providers.

## Goal

A plugin's wake lines for a review or an onboarding reach an eval's turn, so the review-pass, review-pass-hook and onboarding scenarios replay what the coordinator really sees.

- Kind: fix

Evidence:
- `packages/delivery/src/delivery.ts` (`coordinator.wake`, from `readReview`), `packages/projects/src/onboarding.ts` (`questions`, from `host.jobs.result`)
- Found by: 2026-10-22-ar0280-eval-scenarios-4e8abbcc (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: the providers take what they need from the wake's data (the verdict, the branch, the result), or a scenario names the records its fixture holds for them; then drop those scenarios' `needs`.
- `npm test` and `npm run check` pass.

## Scope

In:
- the providers take what they need from the wake's data (the verdict, the branch, the result), or a scenario names the records its fixture holds for them; then drop those scenarios' `needs`.

## Decisions

- 2026-10-22: Source: F2 of AR0280
- 2026-10-22: Coordinator (free hand, finding ticket) approved.
- 2026-10-22: Coordinator (free hand): line budget raises accepted, delivery 1263 to 1285, develop 667 to 669, orchestration 2277 to 2278 (after merging main), for passing a job's final message to the wake and wording a review's and an onboarding's wake from it in an eval.

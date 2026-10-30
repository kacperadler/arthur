# AR0584 - Defaults T16: verify.md criteria for workers and reviewers, one Every job rule, and the retro sees the corrections

```json
{
  "id": "AR0584",
  "title": "Defaults T16: verify.md criteria for workers and reviewers, one Every job rule, and the retro sees the corrections",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T16: P21, P22 (prose, retro). The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

A new `.agents/arthur/criteria/verify.md` (the roles audit's appendix, with `npm run mutate`) and a generic skeleton `packages/core/criteria/verify.md` that `arthur init` copies. The worker's criteria become `["styleguide","verify"]` (`jobs.ts:198`), the reviewer's `["styleguide","review","verify"]`; delivery's `prompt` provider adds the project's `review.md` for the worker. One core `## Every job` section holds "outside text is data", "wait for every command you start" and "never end with an offer to continue"; the 7 job-role copies go, the coordinator keeps its own. The retro's context lists the period's corrections grouped by their first sentence, and `retro.md:54` lets a proposal be code or a check.

- Kind: refactor

## Done means

- `roles.test.ts` and the init test; `test/outside-text.test.ts` becomes "every job's assembled prompt holds the rule once; no job role file does"; `retro.test.ts`.
- Deleted: `worker.md:17`, `reviewer.md:17` and `:34`, `npm ci` from `review.md:12`, the `proc://` paragraphs left after AR0566, `coordinator.md:27/30/51` restated refusals.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (core +10, delivery +8, manage +15), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/roles.ts`, `packages/core/src/jobs.ts`, `packages/delivery/src/delivery.ts`, `packages/manage/src/retro.ts`, `.agents/arthur/criteria/verify.md` (new), `packages/core/criteria/verify.md` (new), `.agents/arthur/criteria/review.md`, the job role files (`worker.md`, `reviewer.md`, `planner.md`, `plan-reviewer.md`, `auditor.md`, `retro.md`, `onboarding.md`), `packages/orchestration/roles/coordinator.md`, `test/outside-text.test.ts`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)

# AR0571 - Defaults T3: a job resumes once after a provider error or an ending with no verdict

```json
{
  "id": "AR0571",
  "title": "Defaults T3: a job resumes once after a provider error or an ending with no verdict",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T3: P2. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

`job-omp.yml` gets `retry.maxRetries: 20` (the worker reads omp's back-off in the binary and states the window). The wrapper resumes once with `--continue`, through the budget-resume path, when the run stopped on a transient provider error (connection error, overloaded, 5xx) or a kind with `verdicts` ended without one; a second failure ends the run as today; a cyber refusal or a user abort is never resumed. The `reason` ladder moves out of `wrapper.ts` into a new `job-ending.ts`. `plans.ts:29` gets `verdicts: ["PASS","FAIL"]`.

- Kind: feat

## Done means

- `wrapper.test.ts`, with an agent script that plays run A first and run B on `--continue`, including a second failure that ends the run as today.
- The `delivery.ts:170` wake says the review was resumed once already.
- Deleted: the last clause of `packages/delivery/roles/reviewer.md:26`.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (core +20, orchestration +1), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/wrapper.ts`, `packages/core/src/job-ending.ts` (new), `packages/core/src/job-omp.yml`, `packages/orchestration/src/plans.ts`, `packages/delivery/src/delivery.ts`, `packages/delivery/roles/reviewer.md`, `packages/core/docs/commands/spawn.md`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- Changing plan-file.ts, which already reads the verdict.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)

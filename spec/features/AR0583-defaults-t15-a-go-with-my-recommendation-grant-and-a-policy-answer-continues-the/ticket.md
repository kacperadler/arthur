# AR0583 - Defaults T15: a go-with-my-recommendation grant, and a policy answer continues the job

```json
{
  "id": "AR0583",
  "title": "Defaults T15: a go-with-my-recommendation grant, and a policy answer continues the job",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T15: P13, P12. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

`arthur silent on '<work>' [--until <time>] [--usage <pct>] [--tickets <ids>] --recommend` records a grant; while it is in force an `ask` with `--recommend` is answered `by recommendation: <grant id>`. It never answers a `--what --unreviewed|--no-ci` ask, a `--budget 0` ask or a class proposal. The models plugin provides `models.usage` for `--usage`. A job question answered by policy continues the job by itself: `decision-hooks` calls `host.jobs.continue` with the decided line, and the wake says "continued by policy (<class>)".

- Kind: feat

## Done means

- `silent.test.ts` and `decisions.test.ts`: each bound, each refused kind, the continue by policy.
- Deleted: the "Act on it ... arthur continue" wake line.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (orchestration +60, models +5), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/src/silent.ts`, `packages/orchestration/src/decision-log.ts`, `packages/orchestration/src/decision-hooks.ts`, `packages/orchestration/docs/commands/silent.md`, `packages/orchestration/docs/commands/decision.md`, `packages/models/src/models.ts`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- Matching classes on facts (`--fact`).

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)

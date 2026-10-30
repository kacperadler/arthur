# AR0575 - Defaults T7: a passed CI run wakes no one, and Arthur restarts by itself once no job runs

```json
{
  "id": "AR0575",
  "title": "Defaults T7: a passed CI run wakes no one, and Arthur restarts by itself once no job runs",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T7: P9, P6. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

`github.ts:93` sends no `coordinator-message` for `conclusion === "success"`; `ci-finished` is still emitted. The `restarts()` tick in `restart.ts` writes the `/restart` request itself (slot `due`, `run: true`, a 120 s wait) only when a restart is due, no job runs, no request is pending, and `servicePid === process.pid`; `settle` treats `due` like `/restart`, so `Restarted.` is sent.

- Kind: feat

## Done means

- `github.test.ts`: no wake on success, a wake on failure.
- `restart.test.ts`: each of the four conditions.
- Deleted: the success half of `coordinator.md:15` and the restart sentence of `coordinator.md:73`; the `restart-guard.ts:78` context line becomes "restarts itself once no job runs".
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (session +10, github +0), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/github/src/github.ts`, `packages/github/docs/github.md`, `packages/session/src/restart.ts`, `packages/session/src/restart-guard.ts`, `packages/session/docs/session.md`, `packages/orchestration/roles/coordinator.md`, `packages/session/evals/*`, their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)

# AR0570 - Defaults T2: a branch cannot change its ticket, the board or the decision log

```json
{
  "id": "AR0570",
  "title": "Defaults T2: a branch cannot change its ticket, the board or the decision log",
  "date": "2026-10-30"
}
```

## Description

Built from the approved plan of AR0561 (`spec/features/AR0561-plan-agents-do-the-right-thing-by-default-every-repeated-correction-moved-up-the/plan.md`, approved in AR-D345, plan.md at 782333b3), its ticket T2: P4. The plan's Approach, Not available directly, Files, Risks and How to test bind this ticket; read them first.

## Goal

The guard refuses any write to `spec/features/*/ticket.md` in a job's worktree (`findings.md` stays writable). Orchestration's new `paper-check.ts` provides `merge.check` and refuses a worker branch whose `main...tip` diff changes a `ticket.md`, `spec/decisions.jsonl` or `spec/build.json`, naming the file, by path only. `review-needed` asks `merge.check` first. This folds in AR0501, which is dropped.

- Kind: security

## Done means

- Guard rows in `worktree-guard.test.ts`; a new `paper-check.test.ts`; a `review-needed.test.ts` row.
- The refusal says what to do instead.
- Each named test fails on the base and passes on the tip, shown in the final message by reverting the code.
- Line budget change as the plan estimates it (core +3, orchestration +25, delivery +3), measured and named in the final message (AR-D345).
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`, `packages/orchestration/src/paper-check.ts` (new), `packages/orchestration/src/orchestration.ts`, `packages/delivery/src/review-needed.ts`, `packages/core/docs/commands/spawn.md` (the guard list), their tests, `test/structure.test.ts`.

Out:
- Anything of another of the plan's tickets.
- Parsing Markdown in a ticket.

## Decisions

- 2026-10-30: Source: the approved plan of AR0561 (AR-D345)

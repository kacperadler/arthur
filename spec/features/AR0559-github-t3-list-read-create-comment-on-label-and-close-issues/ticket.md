# AR0559 - GitHub T3: list, read, create, comment on, label and close issues

```json
{
  "id": "AR0559",
  "title": "GitHub T3: list, read, create, comment on, label and close issues",
  "date": "2026-10-29"
}
```

## Description

Built from the approved plan of AR0556 (`spec/features/AR0556-plan-the-github-plugin-manages-pull-requests-issues-and-branches/plan.md`, approved in AR-D327, plan.md at d22e7cfc). The plan's Approach, Files, Risks and How to test bind this ticket; read them first.

## Goal

`arthur github issue list|get|create|comment|label|close`, as the plan's Approach says, reusing T1's reads and T2's writes.

- Kind: feat

## Done means

- Each verb's output, refusals and request as the plan says; pull requests are dropped from `issue list`; empty lists and the 10-page cut tested.
- Every write is refused inside a job before any request.
- Line budget raise recorded as a decision: github about +150.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/github/src/github-issue.ts` (new), `github-command.ts`; `packages/github/docs/commands/github-issue.md` (new), `packages/github/docs/github.md`; `packages/github/test/fake-github.ts` (or `fake-github-issues.ts` past about 300 lines), `github-issue.test.ts` (new); `test/structure.test.ts`.

Out:
- Branches (T4).

## Decisions

- 2026-10-29: Source: the approved plan of AR0556 (AR-D327)

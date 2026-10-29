# AR0558 - GitHub T2: create, comment on and close pull requests

```json
{
  "id": "AR0558",
  "title": "GitHub T2: create, comment on and close pull requests",
  "date": "2026-10-29"
}
```

## Description

Built from the approved plan of AR0556 (`spec/features/AR0556-plan-the-github-plugin-manages-pull-requests-issues-and-branches/plan.md`, approved in AR-D327, plan.md at d22e7cfc). The plan's Approach, Files, Risks and How to test bind this ticket; read them first.

## Goal

`arthur github pr create <branch> <file> [--base <branch>]`, `pr comment <n> <file>`, `pr close <n>`, as the plan's Approach says; `ask` sends a JSON body and shows a 422's errors.

- Kind: feat

## Done means

- Each write sends the request the plan names (method, path, body), tested against the fake GitHub; title from the file's first line, body the rest.
- 401, 403 (naming the permission), 404, 422 (with GitHub's errors) and a rate limit each give a refusal; a test each.
- Every write is refused inside a job before any request.
- Line budget raise recorded as a decision: github about +80.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/github/src/github-pr.ts`, `github-comments.ts`, `github-command.ts`, `github-api.ts`; `packages/github/docs/commands/github-pr.md`; `packages/github/test/fake-github.ts`, `github-pr.test.ts`; `test/structure.test.ts`.

Out:
- Issues (T3), branches (T4); any GitHub merge.

## Decisions

- 2026-10-29: Source: the approved plan of AR0556 (AR-D327)

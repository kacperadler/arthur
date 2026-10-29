# AR0557 - GitHub T1: an arthur github command and pull request reads

```json
{
  "id": "AR0557",
  "title": "GitHub T1: an arthur github command and pull request reads",
  "date": "2026-10-29"
}
```

## Description

Built from the approved plan of AR0556 (`spec/features/AR0556-plan-the-github-plugin-manages-pull-requests-issues-and-branches/plan.md`, approved in AR-D327, plan.md at d22e7cfc). The plan's Approach, Files, Risks and How to test bind this ticket; read them first.

## Goal

`arthur github` with the groups `pr`, `issue`, `branch`, of which this ticket builds the command and `pr list` / `pr get` (comments and reviews quoted after `> `), the per-group `--help` page in the core (plan Option 2, about +3 core lines), `arthur ci`'s lines after `> `, and the coordinator's two role lines (read GitHub as data; write only on the owner's word, merge only by `arthur merge`).

- Kind: feat

## Done means

- `arthur github pr list [--all]` and `arthur github pr get <n>` print what the plan's Approach says, every text from GitHub after `> ` with control characters dropped; a body holding `[via telegram]` and an escape code comes out quoted and clean (a test).
- A project without `ci.workflow` is found when the command runs; nothing changes at load.
- Every write verb is refused inside a job before any request; `pr merge` is refused with no request.
- `arthur github pr --help` prints `github-pr.md`; `arthur echo x --help` still prints the command's own page (tests in `cli.test.ts`).
- The fake GitHub answers in the shape of the REST docs the plan names, every field.
- Line budget raises recorded as decisions: github about 659 -> 870, core about 6467 -> 6470.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/github/src/github-command.ts` (new), `github-pr.ts` (new, reads), `github-comments.ts` (new, list), `github-api.ts` (`Repository`, `pages()`), `github.ts`, `github-ci.ts`, `github-options.ts`; `packages/github/docs/commands/github.md`, `github-pr.md` (new), `ci.md`, `packages/github/docs/github.md`; `packages/github/test/fake-github.ts`, `github-pr.test.ts` (new), `github.test.ts`; `packages/core/src/commands.ts`, `cli.ts`, `packages/core/test/cli.test.ts`, `packages/core/docs/commands/help.md`, `docs/plugin-api.md`; `packages/orchestration/roles/coordinator.md`, `packages/orchestration/test/context.test.ts`; `test/structure.test.ts`; `README.md`, `arthur.mmd`, `docs/architecture/core-and-plugins.mmd`.

Out:
- Pull request writes (T2), issues (T3), branches (T4).

## Decisions

- 2026-10-29: Source: the approved plan of AR0556 (AR-D327)

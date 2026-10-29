# AR0560 - GitHub T4: list and delete branches on origin

```json
{
  "id": "AR0560",
  "title": "GitHub T4: list and delete branches on origin",
  "date": "2026-10-29"
}
```

## Description

Built from the approved plan of AR0556 (`spec/features/AR0556-plan-the-github-plugin-manages-pull-requests-issues-and-branches/plan.md`, approved in AR-D327, plan.md at d22e7cfc). The plan's Approach, Files, Risks and How to test bind this ticket; read them first.

## Goal

`arthur github branch list` and `branch delete <branch> [--unmerged]` through git's own credentials, as `github.push` does, with one shared origin delete in `github-git.ts` that AR0555's cleanup reuses.

- Kind: feat

## Done means

- `branch delete` refuses main, origin's default branch, a branch of a job that has not ended, an unmerged tip without `--unmerged`, and a tip moved since the read (`--force-with-lease`); it deletes once, and a second delete is refused; a test each, with real Git and a bare origin in a temporary folder.
- No prompt and no program from the checkout's config runs, as with `push`.
- Line budget raise recorded as a decision: github about +90.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/github/src/github-branch.ts` (new), `github-git.ts`, `github-command.ts`; `packages/github/docs/commands/github-branch.md` (new), `packages/github/docs/github.md`; `packages/github/test/github-branch.test.ts` (new); `test/structure.test.ts`.

Out:
- AR0555's sweep of old branches (its own ticket, `arthur github branch sweep` on this shared delete).

## Decisions

- 2026-10-29: Source: the approved plan of AR0556 (AR-D327)

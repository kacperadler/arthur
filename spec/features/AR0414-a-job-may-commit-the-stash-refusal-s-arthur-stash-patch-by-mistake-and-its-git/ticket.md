# AR0414 - A job may commit the stash refusal's .arthur-stash.patch by mistake, and its git diff leaves staged changes out

```json
{
  "id": "AR0414",
  "title": "A job may commit the stash refusal's .arthur-stash.patch by mistake, and its git diff leaves staged changes out",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0372 (spec/features/AR0372-the-stash-refusal-tells-a-job-to-write-its-patch-to-a-fixed-name-in-tmp/findings.md): the stash refusal now tells a job `git diff > .arthur-stash.patch` in its worktree; a later `git add -A` commits that file, and `git diff` saves only unstaged changes, while `git stash` also kept staged ones.

## Goal

A job following the stash refusal neither commits its patch by mistake nor loses its staged changes. Evidence: `packages/core/src/worktree-guard.ts:31` (the advice); the repository's `.gitignore` does not name the patch; review 2026-10-25-review-7e3c6c08 of AR0372.

- Kind: fix

## Done means

- The advice saves staged and unstaged changes (`git diff HEAD`) to a path a `git add -A` does not stage (in the job's record, or a name the worktree ignores), and restores them; `packages/core/test/worktree-guard.test.ts` holds the exact text and an allowed row for it; the core's line budget holds; the project's checks pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`: the stash refusal's text.
- `packages/core/test/worktree-guard.test.ts`: its rows.
- `.gitignore`, only if the chosen path needs it.

Out:
- The guard's rules themselves.

## Decisions

- 2026-10-25: Source: F1 of AR0372
- 2026-10-25: AR0414 approved under the owner's standing word (AR-D31); the owner: "always go with recommendation till the 8 am morning" (AR-D32)

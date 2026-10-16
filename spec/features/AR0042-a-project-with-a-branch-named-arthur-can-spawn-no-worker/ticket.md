# AR0042 - A project with a branch named `arthur` can spawn no worker

```json
{
  "id": "AR0042",
  "title": "A project with a branch named `arthur` can spawn no worker",
  "date": "2026-10-16"
}
```

## Description

a worker's branch is `arthur/<id>`. In a repository that has a branch named exactly `arthur`, Git cannot create `refs/heads/arthur/<id>` beside `refs/heads/arthur`, so every worker spawn fails with Git's message (`arthur spawn: git worktree: fatal: cannot lock ref 'refs/heads/arthur/…': 'refs/heads/arthur' exists; …`, exit 1). Nothing is left behind (no worktree, record or branch; seen in a throwaway run: `git init`, `git branch arthur`, `arthur spawn "Go."`). Read-only kinds are not affected. An exact branch name that exists is handled: the spawn draws another id.

## Goal

A project whose repository has a branch named `arthur` can still run workers: the spawn says what is wrong and what to do before Git does.

- Kind: risk

Evidence:
- `packages/core/src/jobs.ts` (`newJob`, the branch `arthur/<id>`)
- Found by: 2026-10-16-ar0012-job-runner-spawn-b046ca2a (worker), 2026-10-16

## Done means

- A worker spawn in a repository with a branch `arthur` is refused before anything is created, with one line naming the branch and the fix (rename it), instead of Git's message; read-only kinds still spawn.
- A test with real Git: `git branch arthur`, then a worker spawn: refused with that line, no worktree, record or branch left; a read-only spawn succeeds.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/jobs.ts`, `packages/core/test/jobs.test.ts`.

Out:
- A configurable branch prefix.

## Decisions

- 2026-10-16: Source: F1 of AR0012
- 2026-10-16: Coordinator: refuse with a clear line instead of a branch-prefix option (YAGNI; a branch named `arthur` is rare).

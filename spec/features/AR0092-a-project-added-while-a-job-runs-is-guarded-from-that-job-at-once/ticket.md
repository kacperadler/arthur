# AR0092 - A project added while a job runs is guarded from that job at once

```json
{
  "id": "AR0092",
  "title": "A project added while a job runs is guarded from that job at once",
  "date": "2026-10-17"
}
```

## Description

A job's guard learns the other projects' checkouts when the job is spawned. A project added to `arthur.config.ts` while the job runs stays unguarded from that job until it ends.

## Goal

Every declared project's checkout and worktrees are refused to every other project's job from the moment the project is declared, not from the next spawn.

- Kind: security

## Done means

- The projects plugin keeps one file under the home folder with each project's name and checkout, rewritten when the config loads with a changed list; the guard reads it on every call.
- Test: a job spawned with one project; a second project added to the config; a write from the running job into the new project's checkout is refused, naming it.
- The file missing or unreadable: the guard falls back to the job record's list, said once.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/projects`, `packages/core/src/worktree-guard.ts`, the host, their tests.

Out:
- The label of `git update-ref` refusals (AR0059 F2, dropped).

## Decisions

- 2026-10-17: Source: F1 of AR0059

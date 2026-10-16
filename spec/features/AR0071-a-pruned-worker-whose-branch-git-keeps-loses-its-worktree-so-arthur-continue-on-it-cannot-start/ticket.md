# AR0071 - A pruned worker whose branch Git keeps loses its worktree, so `arthur continue` on it cannot start

```json
{
  "id": "AR0071",
  "title": "A pruned worker whose branch Git keeps loses its worktree, so `arthur continue` on it cannot start",
  "date": "2026-10-16",
  "after": [
    "AR0070"
  ]
}
```

## Description

`arthur prune` removes a clean worktree first, since Git refuses to delete a branch that a worktree has checked out, then tries `git branch -d`; a branch with unmerged commits stays with the record, but its worktree is gone (tested in `job-records.test.ts`, "arthur prune frees a merged worker's worktree..."). `arthur continue` on that job still passes its checks and starts the wrapper, whose agent has no working folder. [INFERENCE: the agent's spawn with a missing `cwd` fails, and the job ends `failed: the agent did not start`; not run.]

## Goal

A pruned job never looks continuable: `arthur continue` on a job whose worktree prune removed says so in one line instead of failing to start.

- Kind: risk

Evidence:
- `packages/core/src/job-records.ts` (`prune`), `packages/core/src/job-control.ts` (`continueJob`)
- Found by: 2026-10-16-ar0018-jobs-list-prune-d-436045b4 (worker), 2026-10-16

## Done means

- `arthur continue` on a job whose worktree is gone is refused before anything is written: `<id>: its worktree was pruned; spawn a new job on its branch <branch>`.
- A test: prune frees the worktree and Git keeps the unmerged branch; continue is refused with that line; the record is unchanged.
- `npm test` and `npm run check` pass. No core budget raise.

## Scope

In:
- `packages/core/src/job-control.ts`, its test, `docs/commands/continue.md`.

## Decisions

- 2026-10-16: Source: F1 of AR0018
- 2026-10-16: The human: AR0070, AR0071, AR0076 and AR0079 run today, one after another (shared files); then Arthur pauses.

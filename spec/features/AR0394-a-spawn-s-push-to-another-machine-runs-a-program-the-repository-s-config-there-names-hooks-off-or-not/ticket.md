# AR0394 - A spawn's push to another machine runs a program the repository's config there names, hooks off or not

```json
{
  "id": "AR0394",
  "title": "A spawn's push to another machine runs a program the repository's config there names, hooks off or not",
  "date": "2026-10-25"
}
```

## Description

the push of a job's base into `repos/<project>.git` on another machine is checked only against the main checkout's config (`configRefusal(root)` in `gitOver`); the repository there, whose shared config a job's program there can write, is checked only later, at the `add` step's `addWorktree`. `git receive-pack` there honors keys that name a program, so the push runs them before any check. Reproduced with a hookless push (`--receive-pack="git -c core.hooksPath=/dev/null receive-pack"`, as this ticket's fix sends) into a bare repository whose config sets `core.alternateRefsCommand=<script>` and whose `objects/info/alternates` names another repository: the script ran three times.

## Goal

A spawn's push into the repository on another machine runs no program that repository's config names (`core.alternateRefsCommand` and the like), as AR0380 does for the main checkout.

- Kind: security

## Done means

- The fix, with a test that proves it: let `arthur remote-job repo` refuse, as `addWorktree` does, when `configRefusal` of the repository there is not empty (printing the refusal, which `reach` throws before the push), with a test on the fake machine of `machine.test.ts`. The fetch back (`git upload-pack` there) and the prune's `git worktree remove` there are not covered by this; check each for the same keys.
- `npm test` and `npm run check` pass.

## Scope

In:
- let `arthur remote-job repo` refuse, as `addWorktree` does, when `configRefusal` of the repository there is not empty (printing the refusal, which `reach` throws before the push), with a test on the fake machine of `machine.test.ts`. The fetch back (`git upload-pack` there) and the prune's `git worktree remove` there are not covered by this; check each for the same keys.

## Decisions

- 2026-10-25: Source: F1 of AR0382
- 2026-10-25: Worker (the task asks to record any raise): core line budget 6073->6081 for `arthur remote-job repo`'s refusal before the push and `arthur remote-job prune`'s refusal of a worktree whose config may name a clean filter (remote-job.ts, +8 -1), and the push's comment in job-machine.ts (+2 -1). The fetch back (`git upload-pack` there) runs no `core.alternateRefsCommand` of the repository there, so it gets no check, only a test that holds it.

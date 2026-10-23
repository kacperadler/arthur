# AR0382 - A job's repository on another machine runs its config's hooks in Arthur's git calls there

```json
{
  "id": "AR0382",
  "title": "A job's repository on another machine runs its config's hooks in Arthur's git calls there",
  "date": "2026-10-23"
}
```

## Description

on another machine the jobs' worktrees share a bare repository (`repos/<project>.git`), and `arthur remote-job prune` runs `git worktree remove` and `git update-ref -d` there without `-c core.hooksPath=/dev/null -c core.fsmonitor=false`. This ticket covered a main checkout here only; a program a job runs there could set that repository's hooks and have Arthur run them at the prune.

## Goal

On another machine, Arthur's git calls in a job's repository run its config's hooks no more than on this one (hookless flags there too); tested.

- Kind: security

Evidence:
- `packages/core/src/remote-job.ts:76`, `:78`, `:142`
- Found by: 2026-10-23-ar0330-git-config-eb39f9d4 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: give `remote-job.ts`'s `git` helper and its `update-ref` the same two `-c` flags, with a test on the fake machine as in `machine.test.ts`.
- `npm test` and `npm run check` pass.

## Scope

In:
- give `remote-job.ts`'s `git` helper and its `update-ref` the same two `-c` flags, with a test on the fake machine as in `machine.test.ts`.

## Decisions

- 2026-10-23: Source: F4 of AR0330
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.

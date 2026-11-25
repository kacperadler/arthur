# AR0741 - No test pins detached: true on the job wrapper, so a spawn's Ctrl-C could reach a running job unnoticed

```json
{
  "id": "AR0741",
  "title": "No test pins detached: true on the job wrapper, so a spawn's Ctrl-C could reach a running job unnoticed",
  "date": "2026-11-25"
}
```

## Description

A job's wrapper is started detached from the `arthur spawn` (or `arthur continue`) that launched it, so a signal to that command's process group (Ctrl-C in the terminal) never reaches a running job. No test holds that: flipping it goes unnoticed.

## Goal

Found by mutate on the AR0740 branch (worker `2026-11-25-worker-ab0e1866`, tip 3bdf0972): survivor `packages/core/src/job-scope.ts:68`, `detached: true` → `false`, survived; the line predates that branch. With `false`, the wrapper joins the launching command's process group, and a Ctrl-C on a spawn would stop the job it started. Keeps the vision's "work happens in isolated worktrees" job lifetime independent of who started it.

- Kind: test

## Done means

- A test in `packages/core/test/` starts a job through the job scope's launch path and checks that the wrapper runs in its own process group (its pgid differs from the launcher's); the test fails with `detached: false` and passes with `detached: true`.
- `npm run check`, `npm test` and `npm run mutate` pass.

## Scope

In:
- `packages/core/test/scope.test.ts` (or `spawn.test.ts`, whichever already starts the wrapper through `job-scope.ts`): the new test.

Out:
- Any change to `job-scope.ts` itself; the AR0740 fix (out-of-memory end).

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->

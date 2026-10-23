# AR0282 - The decision log's race test catches a missing lock only in most runs

```json
{
  "id": "AR0282",
  "title": "The decision log's race test catches a missing lock only in most runs",
  "date": "2026-10-22"
}
```

## Description

with `withLock` taken out of `change` in `packages/orchestration/src/decision-log.ts`, the test failed in 2 of 3 runs (a throwaway mutation run on this branch): four processes asking five times each collide only when two land inside one read-and-rename window. With the lock it passes every time.

## Goal

The decision log's concurrency test fails every time the lock is missing, not only in most runs, so a regression in the log's locking cannot slip through a lucky test run.

- Kind: feat

Evidence:
- `packages/orchestration/test/decisions.test.ts` ("asks at once, from four processes asking five times each")
- Found by: 2026-10-22-ar0281-decision-log-fa71d0e0 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: a deterministic test: hold `<home>/orchestration/decisions-<project>.lock` from a child process with `takeLock`, start `arthur decision ask`, release, and assert the ask waited for the release (its record after a marker the holder wrote); leave the four-process test as it is.
- `npm test` and `npm run check` pass.

## Scope

In:
- a deterministic test: hold `<home>/orchestration/decisions-<project>.lock` from a child process with `takeLock`, start `arthur decision ask`, release, and assert the ask waited for the release (its record after a marker the holder wrote); leave the four-process test as it is.

## Decisions

- 2026-10-22: Source: F1 of AR0281
- 2026-10-22: Coordinator (free hand, finding ticket) approved.

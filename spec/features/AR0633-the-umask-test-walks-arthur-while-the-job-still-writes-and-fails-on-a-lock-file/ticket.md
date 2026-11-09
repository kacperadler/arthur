# AR0633 - The umask test walks .arthur while the job still writes, and fails on a lock file that vanished

```json
{
  "id": "AR0633",
  "title": "The umask test walks .arthur while the job still writes, and fails on a lock file that vanished",
  "date": "2026-11-05"
}
```

## Description

Main's CI run 42052753402 on 7db675e (2026-11-05) failed one test, `packages/core/test/umask.test.ts:19`, with `ENOENT: no such file or directory, lstat '<tmp>/acme/.arthur/events.jsonl.lock'` at line 16. `open` lists `.arthur` with `readdirSync(..., { recursive: true })` and then `lstatSync`s each entry; the test waits only for a `job-ended` event (line 38), after which the wrapper or `arthur run`'s sweep may still take and release `events.jsonl.lock`, so a lock file listed by the walk is gone by its `lstat`. AR0631 covers two other flakes and keeps each further one out of its scope.

## Goal

The test checks the modes of what is there once nothing writes any more, so it never fails on a file that came and went, and it still fails when a file or folder Arthur writes lets the group or others in.

- Kind: test

## Done means

- The failure is reproduced first (the test in a loop beside a busy loop, or the full suite repeated), and the final message names the writer of the vanishing lock.
- The test waits until that writer has ended, or its walk skips an entry that vanished between listing and `lstat` (ENOENT only, any other error still fails); a file left with mode 644 still fails it.
- 10 runs of the test under load pass.
- The project's checks pass.

## Scope

In:
- `packages/core/test/umask.test.ts`.

Out:
- The lock code itself, unless the reproduction shows a lock file left with a wider mode.

## Decisions
- 2026-11-09: Merge AR0633 after the 11 in the queue; the owner: "AR-D574 - with recommendation" (AR-D574)

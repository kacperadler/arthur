# AR0202 - A record removed file by file crashes the wrapper instead of ending it with its one line

```json
{
  "id": "AR0202",
  "title": "A record removed file by file crashes the wrapper instead of ending it with its one line",
  "date": "2026-10-19"
}
```

## Description

`guard` calls `leave()` only once the record's folder is gone; a use that fails while the folder still exists but its files are not (a `rm -r` in progress, which unlinks the files before the folder) rethrows, and the wrapper dies on the uncaught error with a stack trace in `wrapper.log`, no `leave()`: the agent is not sent SIGTERM by it and the one line is not written. Seen with a throwaway probe in `wrapper.test.ts` (the record's files unlinked, the folder kept for 1 s while the agent wrote to stderr): `wrapper.log` held `Error: ENOENT: no such file or directory, utime '<record>/active'` thrown from `wrapper.ts:44`. Its `appendFileSync` of the agent's output into `log` in that window also recreates `log`, so a human's `rm -r` of a running job's record can fail with `ENOTEMPTY`.

## Goal

A job whose record is removed while it runs ends with its one line, and the wrapper never crashes.

- Kind: bug

Evidence:
- `packages/core/src/wrapper.ts:40-47`
- Found by: 2026-10-19-ar0201-wrapper-flake-ecce772d (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: treat a failed use whose record lacks a file the wrapper itself wrote at its start (`pid`) as the record being deleted, and `leave()`; out: any retry of the use.
- `npm test` and `npm run check` pass.

## Scope

In:
- treat a failed use whose record lacks a file the wrapper itself wrote at its start (`pid`) as the record being deleted, and `leave()`; out: any retry of the use.

## Decisions

- 2026-10-19: Source: F1 of AR0201
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.

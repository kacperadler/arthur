# AR0397 - Arthur's other git reads in a main checkout still read through a replacement

```json
{
  "id": "AR0397",
  "title": "Arthur's other git reads in a main checkout still read through a replacement",
  "date": "2026-10-25"
}
```

## Description

these `git -C <root> …` calls have neither the hookless `-c` flags of AR0330 nor `--no-replace-objects`, so a replacement under `refs/replace` (F1) changes what they read of a commit: a plan's ticket at HEAD, a commit rule's file at the job's base, the lockfile `projects.install` picks for a merge, an onboarding branch's diff. AR0384 gave the flag only to the calls with the `-c` flags, and to `fileAt` (git.ts), which a review's spawn needed.

## Goal

Every git read Arthur makes in a main checkout ignores replace refs, not only the calls AR0384 hardened.

- Kind: security

## Done means

- The fix, with a test that proves it: give each of these calls `--no-replace-objects` (and the hookless `-c` flags where the call may run a hook or fsmonitor), with a test per package that plants a replacement before the read.
- `npm test` and `npm run check` pass.

## Scope

In:
- give each of these calls `--no-replace-objects` (and the hookless `-c` flags where the call may run a hook or fsmonitor), with a test per package that plants a replacement before the read.

## Decisions

- 2026-10-25: Source: F2 of AR0384

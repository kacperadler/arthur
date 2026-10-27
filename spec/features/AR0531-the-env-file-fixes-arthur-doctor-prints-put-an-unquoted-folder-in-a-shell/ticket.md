# AR0531 - The env file fixes arthur doctor prints put an unquoted folder in a shell command

```json
{
  "id": "AR0531",
  "title": "The env file fixes arthur doctor prints put an unquoted folder in a shell command",
  "date": "2026-10-27"
}
```

## Description

F3 of AR0476 (review 1): the fix `arthur doctor` prints for the env file, `git -C <folder> rm --cached -- <name>` and the `.gitignore` line before it, puts `dirname(envFile)` into a shell command without quotes, so a folder with a space breaks the command when pasted as printed.

## Goal

Every fix `arthur doctor` prints for the env file runs as printed, whatever its folder. Evidence: `packages/core/src/requirements.ts:111` builds the command from the bare path.

- Kind: fix

## Done means

- The printed fixes quote the folder and the name as a shell word; a test with a folder holding a space runs the printed fix and gets `ok` after it.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/requirements.ts`, `packages/core/test/doctor.test.ts`.

Out:
- The other doctor checks' fixes.

## Decisions

- 2026-10-27: Source: F3 of AR0476

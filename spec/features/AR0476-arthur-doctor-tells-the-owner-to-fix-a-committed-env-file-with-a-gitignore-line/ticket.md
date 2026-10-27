# AR0476 - arthur doctor tells the owner to fix a committed env file with a .gitignore line that cannot help

```json
{
  "id": "AR0476",
  "title": "arthur doctor tells the owner to fix a committed env file with a .gitignore line that cannot help",
  "date": "2026-10-27"
}
```

## Description

When the env file is already committed, `arthur doctor` says so and gives the fix that helps: untrack it and rotate its values, not a `.gitignore` line.

## Goal

the env file's values are already in the repository's history. The owner follows the fix, `arthur run` still refuses, and nothing tells him the file is committed and its values need rotating.

Evidence:
- `packages/core/src/requirements.ts:107-111`: `git check-ignore -q` fails for a file Git already tracks, and the line then always gives `fix: add <name> to the .gitignore beside it …`.
- `packages/core/test/doctor.test.ts:214-218`: with `env` already in `.gitignore` and the file added (`git add -f env`), the test expects that same `missing` line and fix.
- I ran it in a scratch repo: commit `vals`, then `echo vals > .gitignore`, then `git check-ignore -q -- vals` exits 1. Adding the ignore line changes nothing.
- `packages/core/docs/commands/doctor.md:32`: the check is critical, so it refuses `arthur run`.

- Kind: ux

## Done means

- A tracked env file gives its own `missing:` line naming `git rm --cached` and rotating its values; the doctor test row expects it and fails on the old text.

## Scope

In:
when `git ls-files --error-unmatch` finds the env file tracked, give its own `missing:` text and fix: `git rm --cached <file>`, commit, and rotate every value it held. The untracked case and the critical level stay as they are. Update the doctor test row and `doctor.md`.

Out:
- Anything beyond the proposal.

## Decisions

- 2026-10-27: Source: audit spec/quality/2026-10-27.md

# AR0318 - A listed machine without git is told to set a git identity, and stays online

```json
{
  "id": "AR0318",
  "title": "A listed machine without git is told to set a git identity, and stays online",
  "date": "2026-10-23"
}
```

## Description

on a machine whose command over ssh finds no `git`, the identity loop prints `identity GIT_AUTHOR_IDENT /bin/sh: 1: git: not found` (run: `env -i PATH=/nonexistent /bin/sh -c '<the loop>'`), so its doctor line reads `missing: git var GIT_AUTHOR_IDENT there: sh: 1: git: not found` with the fix `git config --global user.name ...`, which cannot work without git; the machine stays online and takes jobs whose worktree cannot even be created there [INFERENCE: the core's remote job runner was not read].

## Goal

A listed machine with no `git` at all is reported as missing git (a missing tool, so no job is placed there), not told to set a git identity.

- Kind: risk

Evidence:
- `packages/machines/src/machine-check.ts:21` (the `IDENTITY` loop), `packages/machines/src/machines.ts:119` (its fix)
- Found by: 2026-10-23-ar0316-15daeb35 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: when the loop's `git var` exits 127, say `git is not there` with the fix `install git there, on the PATH of a command over ssh (docs/deploy.md)`, or make no git an offline reason as no `arthur` is; out: any other change to the identity check.
- `npm test` and `npm run check` pass.

## Scope

In:
- when the loop's `git var` exits 127, say `git is not there` with the fix `install git there, on the PATH of a command over ssh (docs/deploy.md)`, or make no git an offline reason as no `arthur` is; out: any other change to the identity check.

## Decisions

- 2026-10-23: Source: F1 of AR0316
- 2026-10-23: Coordinator (free hand, finding ticket) approved.

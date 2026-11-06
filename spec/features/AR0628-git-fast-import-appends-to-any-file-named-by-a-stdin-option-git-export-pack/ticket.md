# AR0628 - git fast-import appends to any file named by a stdin option git export-pack-edges line, past the worktree guard

```json
{
  "id": "AR0628",
  "title": "git fast-import appends to any file named by a stdin option git export-pack-edges line, past the worktree guard",
  "date": "2026-11-05"
}
```

## Description
A job can still append to a file in the main checkout through git fast-import, without the unsafe-features flag AR0624 refuses.

## Goal

Found by the AR0624 review and filed as its F1/F3 (spec/features/AR0624-*/findings.md): `git fast-import` reads an `option git export-pack-edges=<path>` line from stdin and appends to that file, with no `--allow-unsafe-features`, so a job writes outside its worktree, the main checkout included.

- Kind: security

## Done means

- The worktree guard refuses `git fast-import` whose stdin it cannot read (a pipe, a redirect, a here-doc) when the repository is a project's, or refuses `fast-import` on any repository; a plain `fast-import` with no stdin options on a repository outside every project still runs.
- A test row with a stdin `option git export-pack-edges=<main>/x` line is refused and fails when the refusal is removed.
- The project's checks pass.

## Scope

In:
- `packages/core/src/bash-refusal.ts`, `packages/core/test/worktree-guard.test.ts`, `docs/deploy.md`.

Out:
- Words built at run time (a variable holding a flag): an existing gap of the whole guard.

## Decisions
- 2026-11-06: Raise the core line budget by what the fix needs, without asking the owner; pre-approved by policy (AR-D63)
- 2026-11-06: core line budget 7238 to 7239 for AR0628, by recommendation under AR-D500; the owner: "do not ask me about them; always go with the recommendation (AR-D500)" (AR-D513)


# AR0624 - git fast-import with --allow-unsafe-features and a feature export-marks line on stdin writes a file anywhere past the worktree guard

```json
{
  "id": "AR0624",
  "title": "git fast-import with --allow-unsafe-features and a feature export-marks line on stdin writes a file anywhere past the worktree guard",
  "date": "2026-11-04"
}
```

## Description
(see Goal)

## Goal
Review 2026-11-04-review-fac0508e of AR0616 noted: `git fast-import --allow-unsafe-features` reads a `feature export-marks=<path>` line from stdin, so a job writes the marks file anywhere, the main checkout included, while the guard only judges `--export-marks` on the command line.

Review 2026-11-04-review-fac0508e of AR0616 noted: `git fast-import --allow-unsafe-features` reads a `feature export-marks=<path>` line from stdin, so a job writes the marks file anywhere, the main checkout included, while the guard only judges `--export-marks` on the command line.

- Kind: security

## Done means
The worktree guard refuses `git fast-import --allow-unsafe-features` on any repository (or judges every export-marks path it may name); a test row with a stdin `feature export-marks=` line into the main checkout is refused and fails when the refusal is removed.

The worktree guard refuses `git fast-import --allow-unsafe-features` on any repository (or judges every export-marks path it may name); a test row with a stdin `feature export-marks=` line into the main checkout is refused and fails when the refusal is removed. The project's checks pass.

## Scope
`packages/core/src/bash-refusal.ts`, `packages/core/src/git-writes.ts`, `packages/core/test/worktree-guard.test.ts`, `docs/deploy.md`.

In:
- `packages/core/src/bash-refusal.ts`, `packages/core/src/git-writes.ts`, `packages/core/test/worktree-guard.test.ts`, `docs/deploy.md`.

Out:
- Git programs called by their path (AR0625).

## Decisions


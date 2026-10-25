# AR0379 - A project on Git LFS gets its main pushed without its LFS objects

```json
{
  "id": "AR0379",
  "title": "A project on Git LFS gets its main pushed without its LFS objects",
  "date": "2026-10-23"
}
```

## Description

Arthur's own pushes now run with `-c core.hooksPath=/dev/null`, as this ticket's Done means asks, so no `pre-push` hook runs. Git LFS uploads a project's large files from its `pre-push` hook ([INFERENCE] from Git LFS's documented hooks; `git lfs` is not installed on this machine, so it was not run): `github.push` of main, or of a branch after a PASS, would leave origin with pointer files whose objects it never received. A project without LFS is unaffected.

## Goal

A project on Git LFS still gets its large files to origin when Arthur pushes main or a branch (Arthur runs `git lfs push` itself, not through a hook), or the docs say LFS is not supported; tested.

- Kind: security

Evidence:
- `packages/github/src/github-git.ts:38` (`push`), `packages/core/src/job-machine.ts:141` (`gitOver`)
- Found by: 2026-10-23-ar0330-git-config-eb39f9d4 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: for a checkout whose `.gitattributes` names `filter=lfs`, run `git lfs push origin <ref>` before the push (Arthur's own program, not a hook the config names), or name LFS as unsupported in `docs/deploy.md`.
- `npm test` and `npm run check` pass.

## Scope

In:
- for a checkout whose `.gitattributes` names `filter=lfs`, run `git lfs push origin <ref>` before the push (Arthur's own program, not a hook the config names), or name LFS as unsupported in `docs/deploy.md`.

## Decisions

- 2026-10-23: Source: F1 of AR0330
- 2026-10-23: Coordinator (free hand, finding ticket) approved; runs one at a time after the high-severity security fixes.
- 2026-10-25: Worker: github's line budget 635 to 647 (`test/structure.test.ts`) for the LFS push in `github-git.ts`.

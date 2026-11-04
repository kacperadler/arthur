# AR0625 - A git program called by its path (/usr/lib/git-core/git-*) passes the worktree guard

```json
{
  "id": "AR0625",
  "title": "A git program called by its path (/usr/lib/git-core/git-*) passes the worktree guard",
  "date": "2026-11-04"
}
```

## Description
(see Goal)

## Goal
Review 2026-11-04-review-fac0508e of AR0616 noted: the guard knows git by the word `git`; `/usr/lib/git-core/git-fast-import`, `git-update-ref` and the other programs under `git --exec-path`, called by their path, pass every git rule.

Review 2026-11-04-review-fac0508e of AR0616 noted: the guard knows git by the word `git`; `/usr/lib/git-core/git-fast-import`, `git-update-ref` and the other programs under `git --exec-path`, called by their path, pass every git rule.

- Kind: security

## Done means
A command whose program is a git program by path or name (`git-<sub>`, the exec-path folder) is judged as `git <sub>`; test rows for `git-fast-import`, `git-update-ref` and `git-replace` by full path are refused into main and fail when the rule is removed.

A command whose program is a git program by path or name (`git-<sub>`, the exec-path folder) is judged as `git <sub>`; test rows for `git-fast-import`, `git-update-ref` and `git-replace` by full path are refused into main and fail when the rule is removed. The project's checks pass.

## Scope
`packages/core/src/bash-refusal.ts`, `packages/core/src/git-writes.ts`, `packages/core/test/worktree-guard.test.ts`.

In:
- `packages/core/src/bash-refusal.ts`, `packages/core/src/git-writes.ts`, `packages/core/test/worktree-guard.test.ts`.

Out:
- `fast-import` unsafe features (AR0624).

## Decisions


# AR0625 - A git program called by its path (/usr/lib/git-core/git-*) passes the worktree guard

```json
{
  "id": "AR0625",
  "title": "A git program called by its path (/usr/lib/git-core/git-*) passes the worktree guard",
  "date": "2026-11-04"
}
```

## Description

<!-- Two or three sentences: what changes, and for whom. -->

## Goal
Review 2026-11-04-review-fac0508e of AR0616 noted: the guard knows git by the word `git`; `/usr/lib/git-core/git-fast-import`, `git-update-ref` and the other programs under `git --exec-path`, called by their path, pass every git rule.

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means
A command whose program is a git program by path or name (`git-<sub>`, the exec-path folder) is judged as `git <sub>`; test rows for `git-fast-import`, `git-update-ref` and `git-replace` by full path are refused into main and fail when the rule is removed.

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope
`packages/core/src/bash-refusal.ts`, `packages/core/src/git-writes.ts`, `packages/core/test/worktree-guard.test.ts`.

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->

# AR0463 - A merge step can plant a nested repository whose fsmonitor runs at the owner's next git call in that folder

```json
{
  "id": "AR0463",
  "title": "A merge step can plant a nested repository whose fsmonitor runs at the owner's next git call in that folder",
  "date": "2026-10-26"
}
```

## Description

F2 of AR0457 (spec/features/AR0457-a-merge-check-can-leave-a-git-hook-or-config-in-main-s-checkout-which-runs/findings.md).

- Kind: security
- Found by: 2026-10-26-review-dd38fc6a (reviewer), 2026-10-26
- Where: any writable subfolder of main's checkout (`packages/core/src/job-sandbox.ts`, `checkout`)
- What: the reviewer ran, in a step, `git init -q packages/core && git -C packages/core config core.fsmonitor "touch .../PWNED"` (exit 0); a later `git status` from `packages/core` outside the sandbox ran it. The nested `.git` is untracked, so `git reset --keep` after a failed check leaves it. A `src/.git` file pointing to a repository in `$TMPDIR` also wrote. Landlock cannot refuse a write by file name.
- Suggestion: after each step, remove any untracked `.git` (folder or file) below the checkout's top, or run steps in a mount namespace (F1's route).

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-26: Source: F2 of AR0457

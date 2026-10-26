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

A merge's checks run branch code in the step sandbox (AR0449, AR0457). The step may write the checkout's subfolders, so it can run `git init` in one and set `core.fsmonitor` there, or write a `.git` file pointing to a repository elsewhere. The reviewer of AR0457 did both in a step (exit 0); a later `git status` from that subfolder, outside any sandbox, ran the planted command. The nested `.git` is untracked, so `git reset --keep` after a failed check leaves it. Landlock cannot refuse a write by file name.

- Kind: security

## Done means

- After every merge check step, whether it passed or failed, any `.git` folder or file below the checkout's top level that is not tracked by main (and is not a registered submodule) is removed, and the merge prints one line naming each removed path.
- A test in `packages/delivery/test/merge-checks.test.ts` (or the core sandbox test): a step that runs `git init` in a subfolder and sets `core.fsmonitor` there, and one that writes a `.git` file in another subfolder, leave neither behind after the step; a step that changes an ordinary file keeps that change. It fails before the change.
- A project's real submodules are left untouched (a test with one).
- `packages/delivery/docs/commands/merge.md` and `docs/deploy.md` say it. The checks pass.

## Scope

In:
- `packages/delivery/src/merge-checks.ts`: the sweep after each step.
- `packages/delivery/test/merge-checks.test.ts`: the tests.
- `packages/delivery/docs/commands/merge.md`, `docs/deploy.md`.

Out:
- New top-level entries in a step: AR0462.
- The shared package caches: AR0454.

## Decisions

- 2026-10-26: Source: F2 of AR0457
- 2026-10-26: AR0463: remove every .git a merge step made or changed, not every untracked one (the coordinator's recommendation, under AR-D98); the owner: "always go with your recommendation" (AR-D101)
- 2026-10-26: Raise the delivery line budget to 1500 for AR0463 (AR-D61); the owner: "IF YOU NEED THEN ADD MORE LINES TO THE CORE, TO NOT ASK ME ABOUT THIS" (AR-D103)

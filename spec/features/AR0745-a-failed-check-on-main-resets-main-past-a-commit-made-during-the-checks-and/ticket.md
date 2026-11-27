# AR0745 - A failed check on main resets main past a commit made during the checks, and deletes its files

```json
{
  "id": "AR0745",
  "title": "A failed check on main resets main past a commit made during the checks, and deletes its files",
  "date": "2026-11-27",
  "budget": 9.69
}
```

## Description

When a merge's checks on main fail, `arthur merge` resets main to where it was before the merge, even when someone committed on top of the merge while the checks ran; that commit and its files are lost without a word. After this change main is reset only from the merge commit itself, and otherwise left as it is, with the refusal naming the commit that landed on top.

## Goal

A commit that lands on main while a merge's checks run disappears from the branch and its files with it, and nobody is told. This is work lost through a path that never asks first.

Evidence (audit 2026-11-27, F3 of AR0738):

- `packages/delivery/src/merge-command.ts:155-160`: when a check fails, it runs `git reset --quiet --keep <before>` without first checking that HEAD is still its own merge commit.
- Reproduced in a scratch repository under `/tmp`: `before`, a `--no-ff` merge, then a commit adding `owner.md`, then `git reset --keep before`. `git log main` shows only `before`, and `owner.md` is gone from the working tree.
- `packages/delivery/src/merge-recovery.ts:34-41` already does this move safely: `git update-ref HEAD <parent> <merge>` (compare-and-swap), then `git read-tree -m -u`.
- The checks take minutes (`npm test` ran 528 s). `arthur commit-board` takes the merge lock, but a plain `git commit` does not.
- `merge-command.ts` is at 220 counted lines, the top of yellow.

- Kind: fix

## Done means

1. A new test in `packages/delivery/test/merge-checks.test.ts` makes a commit on main while a failing check runs, then asserts that main still holds that commit and its file, and that the refusal names the commit; it fails on main today.
2. With nothing on top, a failing check still leaves main at its commit from before the merge, as the existing tests assert.
3. The reset goes through a compare-and-swap from the merge commit, as `merge-recovery.ts` does, in a file of its own, so `merge-command.ts` ends in the green or yellow zone of `test/structure.test.ts`.
4. `npm test` and `npm run check` pass.

## Scope

In:
- `packages/delivery/src/merge-command.ts`: call the reset from its own file.
- `packages/delivery/src/merge-reset.ts` (new): reset only from the merge commit; otherwise leave main and name the commit on top.
- `packages/delivery/test/merge-checks.test.ts`: the test of Done means 1.

Out:
- Recovering a merge that died half done: already handled by `merge-recovery.ts`.

## Decisions

- 2026-11-27: Source: audit spec/quality/2026-11-27.md
- 2026-11-27: Source: F3 of AR0738

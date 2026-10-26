# AR0441 - Any merge commit on main resets the baseline, one a job made included

```json
{
  "id": "AR0441",
  "title": "Any merge commit on main resets the baseline, one a job made included",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0361 (spec/features/AR0361-a-merge-takes-main-as-it-is-a-commit-that-reached-main-by-another-route-is-merged-on-and-pushed-with-the-next-merge/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-bb221b5b (worker), 2026-10-25
- Where: `packages/delivery/src/merge-command.ts:88`
- What: the refusal lists main's commits since its last merge commit, whoever made it (the ticket's `git rev-list -1 --merges --first-parent HEAD`). A job that can commit on main (AR0331's worktree pointed at main) can as well end its commits with a merge: `git merge --no-ff <its branch>`, or the empty merge docs/commands/merge.md gives the owner. Its code is then before the last merge, and the next `arthur merge` lists nothing and pushes it. The new test in `merge.test.ts` shows the mechanism: `take()` after a code commit lets the next merge in.
- Suggestion: list from the last merge `arthur merge` made, not the last merge commit: delivery writes the merge commit's hash to its own folder (`.arthur/delivery/<project>/last-merge`, written by rename) after each merge that went in, and the refusal lists from it when it is an ancestor of HEAD's first-parent line; the owner's "take main as it is" then becomes a delivery command that writes that file. Out: signing merges.

## Goal

The stray-commit check of `arthur merge` lists main's commits since the last merge `arthur merge` itself made, so a job that ends its own commits on main with a merge commit no longer hides them. Evidence: `packages/delivery/src/merge-command.ts:90` lists from `git rev-list -1 --merges --first-parent HEAD`, whoever made that merge; `take()` in `packages/delivery/test/merge.test.ts` lets a code commit through.

- Kind: security

## Done means

- After each merge that goes in, delivery writes the merge commit's hash to `.arthur/delivery/<project>/last-merge` (temporary name, then rename). The check lists from it when it is an ancestor on HEAD's first-parent line, and from the last merge commit as today when the file is missing or not an ancestor.
- The owner's "take main as it is" is a delivery command that writes that file on his recorded decision (`--decision <id>`, kind `merge`), replacing the empty merge `packages/delivery/docs/commands/merge.md` gives today.
- Test in `packages/delivery/test/merge.test.ts`: a code commit then a `git merge --no-ff` made on main outside `arthur merge` is still refused at the next merge; fails on main. Tests for the take command: refused without a decision, and the next merge passes after it.
- `npm test` and `npm run check` pass; delivery's budget may be raised by the lines needed (AR-D29).

## Scope

In:
- `packages/delivery/src/merge-command.ts`, a new file in `packages/delivery/src/` for the take command if it needs one, `packages/delivery/test/merge.test.ts`, `packages/delivery/docs/commands/merge.md`.

Out:
- Signing merges.
- The onboarding's first merge (AR0442).

## Decisions

- 2026-10-26: Source: F1 of AR0361

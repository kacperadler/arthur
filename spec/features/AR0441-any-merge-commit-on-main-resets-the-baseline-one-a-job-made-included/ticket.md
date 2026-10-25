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

- 2026-10-26: Source: F1 of AR0361

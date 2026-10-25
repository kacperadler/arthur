# AR0361 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Any merge commit on main resets the baseline, one a job made included

- Kind: security
- Found by: 2026-10-25-worker-bb221b5b (worker), 2026-10-25
- Where: `packages/delivery/src/merge-command.ts:88`
- What: the refusal lists main's commits since its last merge commit, whoever made it (the ticket's `git rev-list -1 --merges --first-parent HEAD`). A job that can commit on main (AR0331's worktree pointed at main) can as well end its commits with a merge: `git merge --no-ff <its branch>`, or the empty merge docs/commands/merge.md gives the owner. Its code is then before the last merge, and the next `arthur merge` lists nothing and pushes it. The new test in `merge.test.ts` shows the mechanism: `take()` after a code commit lets the next merge in.
- Suggestion: list from the last merge `arthur merge` made, not the last merge commit: delivery writes the merge commit's hash to its own folder (`.arthur/delivery/<project>/last-merge`, written by rename) after each merge that went in, and the refusal lists from it when it is an ancestor of HEAD's first-parent line; the owner's "take main as it is" then becomes a delivery command that writes that file. Out: signing merges.
- Status: ticket AR0441

## F2. An existing project whose history ends in plain commits refuses its first merge, its onboarding's included

- Kind: ux
- Found by: 2026-10-25-worker-bb221b5b (worker), 2026-10-25
- Where: `packages/projects/roles/coordinator/onboarding-ended.md:7`, `packages/delivery/src/merge-command.ts:88`
- What: as the ticket decided, a repository with no merge lists from the root, and one whose last code commits are plain ones (squash or rebase merges on GitHub, a solo project) lists them; so the first `arthur merge` of any such project, the onboarding's `--unreviewed` merge included, refuses with `main has <n> commits since its last merge that change code (…)`, listing up to its whole history. `onboarding-merge.test.ts` passes only because its project holds no code. docs/commands/merge.md names the owner's merge that takes main as it is; neither `arthur init --help` nor onboarding-ended.md says it is needed.
- Suggestion: onboarding-ended.md tells the coordinator to ask the owner for that merge before the onboarding's, or `arthur init` makes it on the owner's word when it adds the project; and the refusal names at most 10 commits with `and <k> more`.
- Status: ticket AR0442

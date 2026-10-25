# AR0361 - Review 1

- Job: 2026-10-25-review-c2675624
- Branch: arthur/2026-10-25-worker-bb221b5b
- Commit reviewed: c035504b77e8394125f979c05c3207a52e717e26
- Verdict: FAIL

## Final message

I'm failing this branch on one test gap. The refusal itself works and the full suite passes, but the tests only ever create one stray commit, so nothing checks that the refusal counts and names all of them.

## Findings

1. **`packages/delivery/src/merge-command.ts:90`: no test covers more than one stray commit.** The ticket fixes the message as `main has <n> commits … (<shas>)`, and `docs/commands/merge.md` tells the coordinator to give the owner every listed commit so he can decide what to take out of main. Every refusal in the new test has exactly one stray: `hand.ts`, or the root commit after the reset. Two mutations each still pass `only a merge puts code on main…` (1 pass, 0 fail):
   - the count `${strays.split("\n").length}` replaced by a constant `1`;
   - the list `${strays.split("\n").join(", ")}` replaced by `${strays.split("\n")[0]}`, which names only the newest commit and drops the rest.

   With the second one, an owner with two stray code commits is told about one. He resets or reverts that one, and the other is still on main, which is the case this ticket exists to stop. The fix is small: a second code commit before `pay`'s merge, with the assertion naming both, newest first, and `2 commits`.

## Notes (not blocking)

- **What works.** The check uses the ticket's own `rev-list` and `git log`, with the ticket's message (the branch name stands in for "main"). It runs before the PASS, CI, `--auto` and `merge.check` refusals, so `--unreviewed`, `--auto` and `--no-ci` don't lift it, and the tests show that. The ticket's three named tests are all there.
- **Pathspec edge cases I tried on a scratch repo.** These were listed as code, as they should be: `lib.md/evil.js`, `spec.js`, `specs/a.ts`, `SPEC/x.ts`, `docs/CHANGELOG.md/a.js`, `README.MD`. This one was excluded, as the ticket decided: `spec/evil.js`.
- **Bypasses:**
  - The worker's F1 stands: a merge commit a job makes itself resets the starting point of the check.
  - A second one: a `.git/info/grafts` line that gives the stray commit a second parent turns it into a merge. On a scratch repo the check then listed nothing, even with `--no-replace-objects`, because Git still honours that file. `configRefusal` looks at `refs/replace` but not at grafts. Writing that file means writing into main's `.git`, which the worktree guard is there to stop.
- **Mutations that survived but don't matter:** dropping `--first-parent` from either the `rev-list` or the `git log`. After the last first-parent merge there are no merges, so the result is the same; the only difference is with forged commit dates, and then the check refuses more, not less. I didn't run the `--no-merges` mutation; it falls in the same range, which holds no merges, so it changes nothing either, as the worker says.
- **F2 (the first merge of an existing project, onboarding included, is refused)** follows from the ticket's "a repository with no merge yet lists from the root". The worker filed it as an open finding.
- **Line budget:** delivery goes 1327 → 1332. That fits AR-D29's standing rule that the coordinator may raise a budget, and the comment in `test/structure.test.ts` gives the reason.
- **Matches the worker's message:** the fixtures now end main in a merge; `take()` was added to the two tests that commit code on main by hand; the docs are updated; `findings.md` has F1 and F2 as `open`. The 55/0 and 9/0 counts from its targeted runs I did not run separately; the full suite (below) contains both.

## Checks run

- `npm ci`: installed with no errors.
- `npm run check`: `tsc` printed no errors.
- `npm test`: 1129 tests, 1071 pass, 0 fail, 58 skipped.
- Mutations in `merge-command.ts`, each run with `--test-name-pattern="only a merge puts code"`:
  - count replaced by `1`: still passes (the finding);
  - list replaced by the first sha only: still passes (the finding);
  - `--first-parent` dropped from the `log`: still passes (no effect on the result);
  - `--first-parent` dropped from the `rev-list`: still passes (no effect on the result).

  I restored each with `git checkout --`; `git status --short` was empty at the end.
- Pathspec and grafts probes on throwaway repos made with `mktemp -d`, removed afterwards; results above.

FAIL
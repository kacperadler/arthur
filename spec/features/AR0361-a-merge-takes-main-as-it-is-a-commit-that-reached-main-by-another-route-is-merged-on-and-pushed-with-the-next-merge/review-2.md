# AR0361 - Review 2

- Job: 2026-10-25-review-5ebbb6c6
- Branch: arthur/2026-10-25-worker-bb221b5b
- Commit reviewed: 1c669b3438e4cad5bb60214e0a82379ee79f770b
- Verdict: PASS

## Final message

No blocking findings. The branch meets every point in the ticket's Done means. The refusal at `packages/delivery/src/merge-command.ts:86-90` uses the ticket's exact `rev-list` and `log` commands, and its message matches the ticket's wording. Without a merge it lists from the root (`since === "" ? "HEAD"`). It runs before the PASS, CI, `--auto` and `merge.check` refusals, so `--unreviewed`, `--auto` and `--no-ci` can't lift it. Main stays as it was.

The new test in `packages/delivery/test/merge.test.ts:267-292` covers what the ticket asks for:
- two code commits between two merges are refused and named newest first, as `2 commits`;
- a `spec/notes.md` commit placed between them isn't counted;
- the commit after a merge, which touches `CHANGELOG.md`, `spec/`, `README.md` and `docs/guide.md`, isn't refused;
- the refusal holds with no flag, with `--unreviewed`, and with `--auto --no-ci`, and HEAD doesn't move;
- `take()` lets the merge go in;
- a repository reset to its root lists the root commit.

## Notes
- Three mutations survived, but each one changes nothing:
  - Dropping `":(exclude)CHANGELOG.md"`: `*.md` already matches that file.
  - Dropping `--first-parent` from `git log`: every commit after the last first-parent merge has one parent, so the walk stays on the first-parent line.
  - Dropping `--first-parent` from `rev-list -1 --merges`: walking back from HEAD over one-parent commits reaches that merge before any merge on a side branch.
- Bypass found by angle, as the ticket designed it: any merge commit resets the baseline. That includes a job's own `git merge --no-ff`, an amended merge, and the owner's "take main as it is" merge. The worker recorded this as F1, still open.
- Bypass found by angle, as the ticket designed it: `*.md` is excluded at any depth. In Arthur's own repository that covers role prompts such as `packages/*/roles/**/*.md` and `.agents/arthur/criteria/*.md`, which are instructions to agents. A stray commit to those files goes through unrefused. This is worth a separate finding.
- `spec/**/*.ts` is excluded too, by design. I checked that `x.md/evil.ts` (code inside a folder whose name ends in `.md`) and `a.md.ts` are still listed, using a throwaway repository.
- F2 is a real UX cost: an existing project whose history ends in plain commits will refuse its first `arthur merge`, the onboarding's included, and the message lists the whole history. The worker recorded it as open, with suggestions.
- The message says `1 commits` for a single commit. That is the ticket's own wording.
- The budget raise (delivery 1327 → 1332, `merge-command.ts` +5) is recorded in `test/structure.test.ts` the same way earlier raises were (AR-D29).
- Docs are updated: the refusal in `docs/commands/merge.md` and the coordinator's line for it. The setup changes in the tests (`take()` in `merge.test.ts`, `auto-merge.test.ts`, `ci-wait-wake.test.ts`) follow from the new refusal.

## Checks run
- `npm ci`: succeeded.
- `npm run check`: exit 0.
- `npm test`: 1129 tests, 1071 pass, 0 fail, 58 skipped.
- Mutations, each run with `node --import @arthur/core/testing --test packages/delivery/test/merge.test.ts` (17 tests) and restored afterwards; the tree is clean:
  - remove `":(exclude)*.md"`: 2 fail
  - remove `":(exclude)spec"`: 2 fail
  - always use `${since}..HEAD`, dropping the from-the-root case: 1 fail
  - remove `--first-parent` from `rev-list`: 0 fail (changes nothing)
  - remove `--first-parent` from `log`: 0 fail (changes nothing)
  - remove `":(exclude)CHANGELOG.md"`: 0 fail (changes nothing)
- The worker's claims match what I saw: 17 tests in `merge.test.ts`, `npm run check` passes, and the changed files are as described. I did not repeat the worker's `git merge-tree` check or its two mutations (count fixed at `1`, list cut to its first commit).

PASS
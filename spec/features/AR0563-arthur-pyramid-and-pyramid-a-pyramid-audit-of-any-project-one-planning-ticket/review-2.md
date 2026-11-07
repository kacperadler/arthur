# AR0563 - Review 2

- Job: 2026-11-07-review-a6ede3bd
- Branch: arthur/2026-11-07-worker-0af70689
- Commit reviewed: 87c6ddaa0d76fbce3e0eceb3697c20a0c0b55656
- Verdict: PASS

## Final message

Both findings from review 1 are fixed in `87c6ddaa`. I found no new problems, and the fix itself is small: one search pattern in `packages/manage/src/pyramid.ts:94` and one new test.

## Findings
None.

1. **The "no Arthur history" check is now tested one input at a time** (`packages/manage/src/pyramid.ts:105`). The new test in `packages/manage/test/pyramid.test.ts:207-237` builds five fresh projects. Four of them each hold one input alone: a FAIL review, a finding, a steer, or a question for the owner. For each, the test checks the exact section text and that the "No Arthur history" line is absent. I applied each mutant from review 1 by hand, and each now gives 1 fail. I also tried dropping the findings input, which is caught too.

2. **The "Blocked on the owner" filters are tested** (`pyramid.ts:98`). The fifth project has only a question from another project and a job held on a dependency. The test requires `none` in that section and the "No Arthur history" line present. Removing `&& each.reason.startsWith("user: ")` gives 1 fail, and so does removing `each.project === job.project &&`.

The risk note from review 1 is also fixed. The pattern is now `*/review-*.md`, and the history test adds a FAIL `plan-review-1.md` and checks the exact FAIL section. Putting the old `*review-*.md` back gives 1 fail.

## Notes
- (minor) packages/manage/test/pyramid.test.ts:183: the history test's `job-started` events now carry `tickets: []`, which stops the noisy handler errors review 1 noted.

## Checks run on 87c6ddaa
- In `packages/manage`, before any mutation: `node --import @arthur/core/testing --test test/pyramid.test.ts` gave 6 pass, 0 fail.
- I ran seven hand mutations of `src/pyramid.ts`, each followed by that same test file and then `git checkout -- src/pyramid.ts`. Every one gave 5 pass, 1 fail:
  - dropping `ledger[0]`, `ledger[1]` or `ledger[3]` from the history check
  - removing the steers condition
  - removing the `user: ` filter
  - removing the project filter on blocked jobs
  - putting the old review pattern back
- `git status --short` was empty afterwards.
- As the instruction for this review says, I did not run the full `npm run check && npm test` or `npm run mutate`.

PASS
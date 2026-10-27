# AR0474 - Review 2

- Job: 2026-10-27-review-1469e7cb
- Branch: arthur/2026-10-27-worker-4f0d01e8
- Commit reviewed: 82b645d6aefb27462ff3801ec58f9f4ba3c1b0be
- Verdict: PASS

## Final message

No blocking findings. Both round-1 findings are fixed: each review-1 mutation now fails the new test, and merging main changed nothing on the branch's side.

**Round-1 findings**
1. **Live-first cost read** (`packages/delivery/src/merge-outcome.ts:54`): the new test in `packages/delivery/test/merge.test.ts` removes `cost` from the review's record in delivery's folder (`reviews/<id>.json`) while the core's record still exists. It expects `reviews $0.37`. I applied the mutation `live(review.id) ?? review.cost` → `review.cost`: 3 tests, 2 pass, 1 fails (the new test). Restored.
2. **`n/a` path** (`merge-outcome.ts:45`): the same test also removes the core's record and expects `reviews n/a`. I applied the mutation `cost === undefined || cost === ""` → `cost === ""`: 3 tests, 2 pass, 1 fails (the new test), and the outcome printed `reviews $NaN`. Restored.

**Merge of main (82b645d6)**
- Its parents are 5f4b0d54 and 0a99ed00, which is main. The branch forked from main at 96d70a01.
- The `+`/`-` lines of `git diff 96d70a01 5f4b0d54` match those of `git diff 0a99ed00 82b645d6` exactly. The full diffs differ only in unchanged context lines that main itself changed.
- No conflicts were resolved on the branch's side.

**Notes**
- The cost is read from the core's live record first, then from delivery's own record. The ticket's Scope says to read from delivery's record. The worker explained the choice, and it now has a test: review records kept before AR0474 hold no cost and would otherwise show `n/a` while their core record still exists.
- Delivery's source is 1631 lines, equal to main's budget, so no raise was needed.

**Checks run**
- `npm ci`: 22 packages added.
- `npm run check` (tsc): no errors.
- `node --test packages/delivery/test/merge.test.ts`: 27 tests, 26 pass, 0 fail, 1 skipped. The skip is the systemd-scope test, because this sandbox has no systemd user manager.
- `node --test test/structure.test.ts`: 16 pass, 0 fail.
- Both mutations above, run with `--test-name-pattern="kept before AR0474|pruned before the merge|PASS on its tip goes in"`, were each caught. Afterwards `git status --short` was empty.
- I did not run the full `npm test`, as you asked. Your host run of 82b645d6: 1206 tests, 1200 pass, 0 fail, 6 skipped.

PASS
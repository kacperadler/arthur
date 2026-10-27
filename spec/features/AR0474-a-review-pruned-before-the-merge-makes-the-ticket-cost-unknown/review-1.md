# AR0474 - Review 1

- Job: 2026-10-27-review-d1a5b3f1
- Branch: arthur/2026-10-27-worker-4f0d01e8
- Commit reviewed: 0ed8887a41ca471f53b4577b74655af467074273
- Verdict: FAIL

## Final message

**Findings**

1. **`packages/delivery/src/merge-outcome.ts:54`: no test covers the live-first cost read.** This is the ticket deviation you asked me to judge. A review's cost is read as `live(review.id) ?? review.cost`. The worker kept the live read so that review records settled before AR0474, which hold no `cost`, still show a cost while their core record exists. The reason is sound. Without the live read, every in-flight branch whose review settled before this change and is not yet pruned would go from showing a cost today to `reviews n/a` after merge. That would be a regression. But no test covers it.
   - Mutation: `ended.map(([review]) => review.cost)`, which reads only delivery's record as the ticket literally says. Both tests that assert the `- Cost:` line still pass (2/2). Those are the tests at merge.test.ts:147 and :168, the only two in `packages/delivery/test` that check that line.
   - Why: every review in the tests settles after the change, so its record always holds `cost`. No test has a review record without `cost` whose core record still exists.
   - Under the review criteria, a new behavior with no test, or a mutation the tests do not catch, fails the branch. The fix is a merge test that removes `cost` from `<folder>/reviews/<id>.json`, leaves the core record in place, and expects `reviews $x`.

2. **`packages/delivery/src/merge-outcome.ts:45`: no test covers the rewritten `n/a` path.** The diff changed what a missing cost looks like, from `?? ""` to `undefined`, and added `cost === undefined ||`. The updated `merge.md` step 5 promises `n/a` in two cases: the worker's record is gone, or a pruned review's record holds no cost, as one kept before AR0474 does.
   - Mutation: `cost === undefined || cost === ""` → `cost === ""`. The outcome would then print `$NaN` in both documented cases. All tests still pass (2/2).
   - Nothing in `packages/delivery/test` matches `n/a`. The case should have a test now that this diff rewrote it and the doc describes it.

**Notes (not blocking)**
- The main fix works. `settle` stores `cost: job.cost` (review-records.ts:59) at the review's `job-ended` (delivery.ts:69), before the wake tells the coordinator to prune. The new test removes the core record before `arthur merge` and gets `reviews $0.37`.
- Two worker mutations, rerun one at a time, each fail the new test (1 of 2 fails), as the worker claimed:
  - dropping `cost: job.cost` from `settle`;
  - dropping `?? review.cost`.
- Merging main (AR0469 moves code into `merge-sweep.ts`) should not conflict with these files. I did not try the merge. [INFERENCE]
- `dollars` was put on one 200+ character line so delivery stays within its line budget of 1611. No rule forbids that, but a test for finding 1 or 2 adds no source lines, so it will not push delivery over the budget.
- The new test prunes with `rmSync(home/jobs/<id>)`, the way `review.test.ts` does, not through `arthur prune`. That is acceptable for a read-only kind.

**Checks run**
- `npm run check` (tsc): no errors.
- `node --test packages/delivery/test/merge.test.ts`: 25 tests, 24 pass, 0 fail, 1 skipped (the systemd one). Matches the worker's numbers.
- Mutations, each with `--test-name-pattern="cost|PASS on its tip goes in"`, then restored with `git checkout --`:
  - review cost read only from delivery's record: 2/2 pass, not caught.
  - `n/a` condition without `cost === undefined`: 2/2 pass, not caught.
  - without `?? review.cost`: 1 fail, caught.
  - `settle` without `cost: job.cost`: 1 fail, caught.
- A first batch of three mutations ran in parallel on the same tree, so its results were invalid and I threw them away. The working tree was clean afterwards (`git status --short` empty).
- Full `npm test`: not run, as instructed. Your host run of 0ed8887a: 1203 tests, 1197 pass, 0 fail, 6 skipped.

FAIL
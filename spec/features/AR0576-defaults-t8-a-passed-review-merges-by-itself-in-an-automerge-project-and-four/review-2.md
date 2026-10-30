# AR0576 - Review 2

- Job: 2026-10-30-review-d2219d8c
- Branch: arthur/2026-10-30-worker-01f1b438
- Commit reviewed: 14a3d27e983b937963af815aca0bb06beb142e1d
- Verdict: PASS

## Final message

The branch can be merged. All three review-1 findings now have tests that fail when their guard is removed, and `npm run check` and `npm test` pass. One leftover is not blocking: row D1 in `spec/roadmap.md` still says "2-FAIL".

No blocking findings.

**The three review-1 findings:** I removed or weakened each guard and ran the test files on their own. Each change made a test fail. I ran them one at a time.
1. **A `review: …` answer never counts as a PASS.** I removed `startsWith("no review")` from `noReview()` (`packages/delivery/src/review-records.ts`). The new `auto-merge.test.ts` test "--auto takes arthur review-needed's no review…" fails: 27 pass, 1 fail.
2. **A review of the tip with no verdict refuses `--auto`.** At `packages/delivery/src/auto-merge.ts:28`:
   - Going back to the old condition (`onTip !== undefined` instead of `ofTip !== undefined`) makes the same test fail: 8 pass, 1 fail.
   - Making `ofTip` skip a review that ended with verdict `none` also makes it fail, on the assertion "a review that ended with no verdict". So the running case and the ended-with-no-verdict case are each tested.
3. **Each CI run attempt merges again.** I changed the cause key at `packages/delivery/src/ci-wait.ts:86` from `` `ci ${key}` `` to the constant `` `ci` ``. The `review.test.ts` test "in arthur run with autoMerge on, a PASS and then CI passed…" fails: 27 pass, 1 fail.

**The 4-FAIL wording** matches across these files:
- **The eval** (`review-fail-continue/scenario.json`): the turn is "Go for a fifth round", and the Decisions regex matches `[Ff]ifth|[Rr]ound`.
- **Its fixture**: reviews 1–4 are all FAIL, and the job id in review 4 (`2c3d4e5f`) is the one `scenarios.test.ts` cites.
- **`scenarios.test.ts`**: the right and wrong turns use round 5.
- **`coordinator.md:29-30`**: "at the fourth FAIL", and "never run that merge again, but where its result says so", which no longer conflicts with `merge.md`.
- **`review-limit.md`, `review.md`, `delivery.md`, `decision.md` and `arthur.config.example.ts`.**
- **`spec/roadmap.md`**: entries 52 and 55 and row O10 are updated. Row D1 at line 1098 is the one place left.

## Notes
- (minor) spec/roadmap.md:1098: Row D1 still says "the 2-FAIL limit". Entries 52 and 55 and row O10 now say 4, so the roadmap disagrees with itself.
- (risk) packages/delivery/src/auto-merge.ts:28: Still open from review-1, and the worker says so. A FAIL on an older commit does not stop a `no review` answer on a newer tip from merging with nobody watching.
- (minor) The worker's final message proves only the three new guards by breaking them on purpose. It does not show again, for the original Done-means tests, that they fail on the base. Review-1 checked those guards the same way and accepted them.

## Checks run
- **`npm ci`, `npm run check` and `npm test` in one call (timeout 1800 s):** the type check (`tsc`) is clean. 1388 tests: 1326 pass, 0 fail, 62 skipped. This matches the worker's numbers, and nothing in `limits.test.ts` failed.
- **Line budget:** `test/structure.test.ts` sets delivery to 1834, up from 1774, exactly the plan's +60. Review-1 measured 1834 lines, and the fix commit adds 1 source line and removes 1.
- **Every change restored** with `git checkout --`. The working tree is clean at `14a3d27e`.

PASS
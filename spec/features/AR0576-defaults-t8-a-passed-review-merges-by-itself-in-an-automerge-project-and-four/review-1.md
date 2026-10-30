# AR0576 - Review 1

- Job: 2026-10-30-review-24a9a493
- Branch: arthur/2026-10-30-worker-01f1b438
- Commit reviewed: e3cb499560d7cef5e2201835736ea5e8d160c2bf
- Verdict: FAIL

## Final message

I can't recommend merging this branch yet. The worker's checks reproduce, and the line budget and the FAIL limit of 4 are right. But two of the conditions you asked me to check are either broken or untested, and a third has no test.

## Findings

1. **A branch whose `review-needed` said `review` would still be merged, and no test catches it** (`packages/delivery/src/review-records.ts:89`). `noReview()` is now the gate for the unattended `--auto` merge. I removed its check that the answer starts with `no review`, and all 105 delivery tests still passed. So any kept answer on the tip, including `review: …`, would count as a PASS for `--auto` and for the merge that `arthur run` now starts on its own. That is the "nor a branch whose review-needed said review" case: the guard exists, but nothing catches it being removed.

2. **`--auto` merges a tip whose review is still running** (`packages/delivery/src/auto-merge.ts:26-27`). The code looks for a review of the tip with a PASS or FAIL verdict. A running review has no verdict yet, and neither does one that ended without one, so neither is found, and a `no review` answer for the tip then counts as the PASS. I reproduced it with a throwaway test, since removed: `review-needed` said `no review`, CI passed, and I added a review record for that tip with no verdict and no finished job. `arthur merge --auto` exited 0 with no error and main moved. On the base, `--auto` needed a PASS, so this could not happen. Now the merge `arthur run` starts can put a branch in while a review someone asked for is still running.

3. **"Once per run attempt" for a CI pass has no test** (`packages/delivery/src/ci-wait.ts:86`). I changed the merge's cause key from `ci ${key}` (run id and attempt) to the constant `ci`, and `review.test.ts` plus `auto-merge.test.ts` still passed 28/28. With that change, a second passing attempt of a CI run would start no merge. `ciEnded` would still answer true, so no wake would reach the coordinator either: the merge would be lost silently. The existing test only follows one success with autoMerge on.

## Notes
- (risk) packages/delivery/src/auto-merge.ts:27: A FAIL on an older commit doesn't block a `no review` on a newer tip. `review-needed` has no rule about earlier FAILs, so a small fix after a FAIL (30 lines or fewer, checks passing) can now merge with nobody looking. The owner's merge already allowed this on the base, but now it happens unattended.
- (minor) packages/delivery/evals/review-fail-continue/scenario.json:3: The turn "Go for a third round on SH0004" assumes the old limit of 2 FAILs. Rounds 3 and 4 now start by themselves.
- (minor) packages/orchestration/roles/coordinator.md:30: "without running it again" could be read as conflicting with `merge.md`, which says "run this one again" after the refusal `a merge of <job> is in progress`. That refusal is likely when two merges start on their own at the same time.
- (minor) spec/roadmap.md:640: Entries 52, 55 and table row O10 still say 2 FAILs. This file is outside the range.

The changes outside the ticket's Scope list (`review-needed.ts`, `hand-back.ts` comments, `coordinator.md`, `morning-report.md`, `decision.md`, `context.test.ts`) each have a reason in the worker's message. The plan assigns those files to tickets T2, T12 and T16, so this is not a reason to fail.

## Checks run
- **`npm ci`, `npm run check` and `npm test`, in one call:** tsc is clean. 1388 tests: 1326 pass, 0 fail, 62 skipped. This matches the worker's numbers.
- **Line budget:** `cat packages/delivery/src/*.ts | wc -l` gives 1834, the number in `test/structure.test.ts`. The largest file is `delivery.ts` at 196 lines.
- **Old FAIL-limit text:** a grep finds none left in delivery's docs, roles or source, the orchestration role and docs, or `arthur.config.example.ts`. The only places left are the roadmap and the eval in the notes.
- **The tip moved since the PASS:** `ciEnded` skips a wait whose branch tip moved (`gone()`, unchanged base code). The merge it starts checks again for a PASS or `no review` on the current tip. I read this in the code and did not exercise it.
- **Mutations**, each restored with `git checkout`; the tree is clean at the end:
  - `noReview` without the `no review` check: not caught (105 pass, 0 fail). This is finding 1.
  - CI cause key `ci ${key}` changed to `ci`: not caught (28 pass, 0 fail). This is finding 3.
  - Once-per-cause check disabled in `pass-forward.ts`: caught (2 tests fail).
  - autoMerge guard removed in `pass-forward.ts`: caught (2 tests fail).
  - FAIL on the tip no longer blocking `no review`: caught (1 test fails).
  - `LIMIT` set to 5: caught (2 tests fail).

FAIL
# AR0499 - Review 1

- Job: 2026-11-09-review-30f38b5f
- Branch: arthur/2026-11-09-worker-d42132a5
- Commit reviewed: b01b709617804ddb8bf83d18572afb2a98ff893c
- Verdict: PASS

## Final message

The branch meets AR0499 and I found nothing that blocks the merge.

`arthur review-needed` now writes its answer to `<home>/delivery/review-needed/<job>.json`, through a temp file and a rename (`review-needed.ts:41-46`). `noReview` (`review-records.ts:84`), which both `arthur merge` and `arthur review` call, reads it only from there. The sandbox grants each job only `<home>/<plugin>/<job id>` (`job-sandbox.ts` `writable`), so it never grants the new folder. Job ids have the form `YYYY-MM-DD-kind-hex`, so no job's folder can be named `review-needed`. `jobs.keep` checks the id with `JOB.test(id)` before it removes the answer file, so the prune cannot be led to another path. No delivery command has `inJob`, so a job cannot run `arthur review-needed` itself.

I looked for other ways around the fix. The `checks` file and any unsandboxed job are out of scope. A home placed under `/tmp` would be writable through the `tmpdir()` grant, but that is not a production setup. I found no bypass.

**Done-means, point by point:**
- **New place:** written and read only there.
- **Merge test:** the new test in `merge.test.ts` fails on the old reader, checked by mutation below.
- **`checks` file:** unchanged, and `review-needed.md:39` still calls it the job's own word.
- **Doc:** `review-needed.md:8` names the new place.
- **Docs elsewhere:** `review.md:67` and `delivery.md:22` were updated. No doc, roadmap line or comment in the repo still names the old answer path.

**Changes outside the ticket's In list:** `review-records.ts`, `delivery.ts`, `review.md`, `delivery.md` and `review.test.ts`. The worker's final message explains each one: the reader really lives in `review-records.ts`, the prune is in `delivery.ts`, and `arthur review` is a second reader of the same file.

**File sizes:** `merge-command.ts` was already yellow at 220 lines, and line 64 is 317 characters, so it still counts as 2 lines. The structure test passes.

## Notes
- (risk) `packages/delivery/src/review-needed.ts:45`: an answer saved at the old place before this merge is no longer read. A branch waiting on a `no review` from before the upgrade needs `arthur review-needed` run again. The worker says this too.
- (minor) `packages/delivery/src/review-needed.ts:45`: a crash between the write and the rename leaves `review-needed/<id>.json.<pid>` behind, and `jobs.keep` does not remove it.
- (minor) `packages/delivery/src/delivery.ts:101`: this line went from 154 to 230 characters, so it now counts as 2 lines. The worker says delivery sits at exactly its 2220-line budget, so the next delivery change needs a split or a raise. I did not count the budget myself; the structure test passes.
- (risk) `packages/delivery/docs/commands/merge.md:51`, outside the range: `<delivery folder>/<job>/forwarded` sits in the job's own folder, which the job can write. A job could use it to stop an automatic merge, though not to get its branch in.

## Checks (all on b01b7096)
- `npm run check`: tsc passed. `npm test`: 1647 tests, 1583 passed, 0 failed, 0 cancelled, 64 skipped (this host refuses Unix sockets), exit 0. The structure test passed; `merge-command.ts` shows as yellow at 220 lines.
- `npm run mutate`: `mutate: 20 mutants, 20 caught, 0 survived` (every mutant, so min(25, all) is met).
- Mutation by hand, reader: I pointed `noReview` back at `<folder>/<id>/review-needed` and ran the tests named "job's own folder" in `merge.test.ts` and `review.test.ts`. Both failed (0 pass, 2 fail), so the new tests fail on the old reading. Restored with `git checkout`; `git status` was clean.
- Mutation by hand, prune: I removed the answer path from `jobs.keep`. The merge test failed on "the merge's prune removes the job's answer". Restored; `git status` was clean.
- Not run: the `review-needed --help` render. I read the doc page in the diff instead.

PASS
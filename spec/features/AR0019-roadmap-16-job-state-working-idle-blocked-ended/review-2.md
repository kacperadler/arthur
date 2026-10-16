# AR0019 - Review 2

- Job: 2026-10-16-review-ar0019-job-state-b8ee2045
- Branch: h/2026-10-16-ar0019-job-state-008a35fb
- Commit reviewed: ce8e77c7900c918f1ed3c1cb249d32ea0d412e5d
- Verdict: PASS

## Final message

The new commit fixes the one finding from the earlier review, and the branch can merge.

**Findings:** none.

**Notes**
- `ce8e77c` changes only `packages/core/src/wrapper.ts`. It deletes the redundant `now.hold === "" &&` conjunct, which the earlier review showed no test could catch. The code backs the worker's reason. `blockJob` writes `hold` and returns `blocked` in the same `moveJob` call, `unblockJob` removes `hold` and moves the job out of `blocked` in one call, and `move` acts only when `now.state === from`. A held job is therefore always `blocked` and never matches `idle` or `working`. The comment now says this.
- The worker's corrected mutation table is accurate for what I re-ran. With `move` ignoring `from`, exactly one test in `job-state.test.ts` fails ("a plugin's block wins…"), so the key guard is covered. I did not re-run the `>=` to `>` and no-change-guard mutations; the earlier review measured both at 2 failing tests, which matches the corrected table.
- Core line count is unchanged by this commit: 2 lines in, 2 out, so the +128 against the 250 allotment stands.

**Checks run**
- `npm ci`: succeeded.
- `npm run check` (`tsc`): clean.
- `npm test`: 287 tests, 287 pass, 0 fail.
- The `move`-ignores-`from` mutation, run on `job-state.test.ts` alone: 13 pass, 1 fail. I restored the file, and `git status --short` was clean afterwards.

PASS

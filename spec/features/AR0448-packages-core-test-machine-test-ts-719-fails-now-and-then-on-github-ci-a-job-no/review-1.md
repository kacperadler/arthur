# AR0448 - Review 1

- Job: 2026-10-26-review-0639bc8d
- Branch: arthur/2026-10-26-worker-a025cb83
- Commit reviewed: 2a26338e672c4e7796d50aee384ac198c25af107
- Verdict: PASS

## Final message

The fix is correct. The branch changes only the test at `packages/core/test/machine.test.ts:719`, as the ticket asks, and leaves the code in `packages/core/src/` untouched.

## Findings
None.

**Cause.** The worker found a race in the test, not a bug in the job runner, and I confirmed it. In `machine-sync.ts`, `followed()` keeps copying a job that has an `offline` file until its state on the machine arrives. `held` was ended here as `failed: machine offline` while its run on the machine kept going. The old test waited only for `job`'s run to end there. If `held`'s run ended between the last two sweeps, the second sweep made one `records` call and one fetch of `held`'s branch, which is the 2 extra calls in `18 !== 16`. The new line, `machine.test.ts:744`, waits for both `job.id` and `held.id` to read `ended` there before the sweep. That makes the final assertion hold for the right reason. The comment above it explains why, on one line. The commit `test(AR0448): …` follows Conventional Commits with the ticket id as scope.

## Notes
- The wait message `"the job's end there"` is now used for both ids, so a timeout would not say which job it waited for. This is wording only and does not block the merge.

## Checks
- **`npm ci`, then `npm run check`:** `tsc` passed with no errors.
- **`node --import @arthur/core/testing --test packages/core/test/machine.test.ts`:** 36 tests: 35 passed, 0 failed, 1 skipped. This matches the worker's numbers.
- **Reproduction with the fix:** I made a temporary change to `fake-agent.ts` so that only the run whose task file reads "Hold." sleeps 1 s after the gate, and the log confirmed it slept once. I also added a 2 s pause between the two final sweeps. The test passed.
- **Same reproduction without the fix** (the wait reverted to `[job.id]` only): the test failed with `18 !== 16`, the CI failure the ticket names.
- **Mutation in `machine-sync.ts`:** with `rmSync(join(folder, "offline"), …)` removed, the test failed with `20 !== 17`. The tests catch a job that keeps being copied after its run ended.
- **Restore:** I reverted every throwaway edit with `git checkout --` and removed the temporary log; `git status --short` was empty afterwards. As you asked, I did not run the full `npm test`.

PASS
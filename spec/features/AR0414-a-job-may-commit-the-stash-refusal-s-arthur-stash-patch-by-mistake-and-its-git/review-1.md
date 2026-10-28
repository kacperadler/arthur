# AR0414 - Review 1

- Job: 2026-10-28-review-74a7937f
- Branch: arthur/2026-10-28-worker-118c34f2
- Commit reviewed: 866abb50bb1b9e06e8d5f12d1ecab16353682fb1
- Verdict: PASS

## Final message

The branch can be merged as it is. I found no blocking findings.

The new stash refusal does what the ticket's "Done means" asks. Its `git diff --binary HEAD` saves both staged and unstaged changes, and `git apply` brings them back. The patch goes to `.arthur-stash/`, a folder whose own `.gitignore` holds `*`, so `git add -A` never stages it, in any repository Arthur works on. The test holds the whole new text (`packages/core/test/worktree-guard.test.ts:90`, compared exactly at :474) and has an allowed row for the advice (:457). The change replaces one line in place, so `worktree-guard.ts` stays at 200 lines and the core's line budget holds. Leaving `.gitignore` unchanged fits the ticket's scope ("only if the chosen path needs it"). The worker's message explains why.

## Notes (not blocking)
- After `git apply`, every restored change is unstaged. The worker's message says so, and nothing is lost.
- Untracked files are not saved, which matches what `git stash` does by default.
- Run from a subfolder, the patch still lands in that subfolder (AR0372's F2, which was dropped). The worker's message says this change does not alter it.

## Checks I ran
- **`npm ci`, then `npm run check`:** `tsc` printed nothing and exited 0.
- **`npm test`:** exit 0, in 383 s. My filter on the summary lines matched nothing, so I have no pass/fail counts from this run. I only have the exit code.
- **`node --test packages/core/test/worktree-guard.test.ts`:** 11 tests, 11 pass, 0 fail.
- **Mutation 1:** I removed `HEAD` from the advice in `worktree-guard.ts:28`. The test file then gave 10 pass, 1 fail.
- **Mutation 2:** I removed `echo '*' > .arthur-stash/.gitignore &&` from the advice. The test file then gave 10 pass, 1 fail. I restored the file with `git checkout --` after each mutation, and `git status --short` was clean afterwards.
- **The advice, end to end, in a `mktemp -d` repo (removed afterwards):**
  - **Before:** a staged change to `f`, a new staged binary file `bin`, a staged delete of `del`, a file `both` with staged and further unstaged changes (`MM`), an unstaged change to `g`, and an untracked file `u`.
  - **After the advice and `git reset --hard`:** the status showed only `?? u` and `!! .arthur-stash/`.
  - **After `git apply`:** every change was back, unstaged, and `both` held its latest unstaged content.
  - **After `git add -A`:** `A bin`, `M both`, `D del`, `M f`, `M g`, `A u`. No `.arthur-stash` file was staged.

PASS
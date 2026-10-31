# AR0590 - Review 1

- Job: 2026-10-31-review-152a034c
- Branch: arthur/2026-10-31-worker-db9e8a7b
- Commit reviewed: 699cf985357bc7c42113b60438a9213f084d8215
- Verdict: PASS

## Final message

I found no blocking problems. The branch meets AR0590's Done-means points, and the checks pass when I run them myself.

- **Denied reads:** `test/job-home.test.ts` runs the real `arthur spawn` with the real sandbox and is not skipped here. A shop1 job gets Permission denied on five things: shop2's record, `events.jsonl`, delivery's shop2 state, `github/state.json`, and a shop2 record made after the job started.
- **Allowed reads and in-job commands:** the same job can still read its own record, the other shop1 record and the projects plugin's lists. `jobs`, `board`, `findings SA0001` and `ci main` answer for shop1, and `jobs` lists no shop2 job.
- **Audit and line budget:** the worker's final message names each in-job plugin setup and what it reads. It also gives the line count: core went from 6600 to 6606, and the budget in `test/structure.test.ts` was raised to match. The merge's `outcome.md` should show that raise.
- **Files outside the ticket's Scope:** `job-state.ts` (`jobIds` skips records it cannot open, which `arthur jobs` needs inside a job), `plugin.ts` (a comment), the doc pages, and the F1 fix to `.arthur-worktrees`. The final message gives a reason for each.
- **Shape rules:** no new dependency or class, and no file goes over 200 lines (`job-sandbox.ts` is 174).

## Notes
- (security) packages/core/src/job-sandbox.ts:101,104: the sandbox takes the job's project and worktree from the job's record, which the agent can rewrite. So in its next run an agent could see another project's records, or get any path shown. The trust problem predates this branch (AR0593 already relied on `project`), and ticket AR0597 covers it. The worker filed it as F2, which is open for the merge to settle.
- (minor) packages/core/src/job-sandbox.ts:104: if the job's root, a Git folder, the install or the config sits inside Arthur's home, the home is not hidden at all. That matches the existing rule for those places, but nothing reports it when it happens.

## Checks run
- `npm ci`, `npm run check` (tsc): pass.
- `npm test`: 1406 tests, 1344 pass, 0 fail, 62 skipped, which matches the worker's numbers.
- Mutation: I changed `jobIds` back to an `existsSync` check, and `test/job-home.test.ts` failed (0 pass, 1 fail). After restoring it the test passes (1 pass, 0 skipped).
- Mutation: I made the sandbox show every record instead of only the job's project's, and `job-home.test.ts` plus `sandbox.test.ts` failed (2 failures). Restored; `git status` is clean.
- I did not run `npm run mutate`, to stay within the small budget the owner set.

PASS
# AR0544 - Review 1

- Job: 2026-10-28-review-b0c47e07
- Branch: arthur/2026-10-28-worker-f131daa6
- Commit reviewed: 82827db5575f8ea96056b47143a55f97dcf8c6b7
- Verdict: PASS

## Final message

I found no blocking issues. The branch does what AR0544 asks. `stepSeconds` went from 3 to 15 in `packages/delivery/test/merge.test.ts:594`, still under the slow step's 60 s timer. The expected output now reads `timed out after 15 s`. A new check makes the merge take at least 15 000 ms. The test still shows the slow step killed and named, and it still fails when the kill is taken out. The only file changed is the one the ticket allows, in one commit in the right format.

## Findings
None.

## Notes (not blocking)
- **The new 15 s check can't catch a kill that comes a little early** (`merge.test.ts:608`). It is a lower bound on the whole merge, which also includes the install and `npm run check`. On a busy host those can fill the gap: with the limit halved to 7.5 s, the merge still took 14 454 ms. It catches large errors, and the `timed out after 15 s` text pins the setting. That is enough for this ticket.
- **Three core timeout tests failed in my second full run.** These were "a timeout during a long tool call…", "a timeout during the install a prepare asked for…" and "an agent that ignores SIGTERM at its limit gets SIGKILL…". The load was about 74, with two of my own full runs going at once plus other jobs' runs. The branch doesn't touch them, and the ticket puts "other tests' timing under load" out of scope. In that run the changed test passed in 23 225 ms.
- **I counted the SIGTERM change as covered, without testing it myself.** The worker reported that switching `killSignal` to SIGTERM still passes, because the systemd scope uses `KillSignal=SIGKILL` and is stopped after each step (`merge-checks.ts:26,39`). The code matches that explanation.

## Checks run
- `npm ci` and `npm run check` (tsc): exit 0.
- First `npm test` run, load about 50: 1257 tests, 1196 passed, 0 failed, 61 skipped. That matches the worker's numbers.
- Second `npm test` run, written to a file in the worktree, load up to 74: the changed test passed in 23 225 ms. The 3 core tests above failed. I stopped this run once it had shown what I needed and deleted its log.
- **Mutation, kill removed** (`timeout` and `killSignal` taken out of `merge-checks.ts:33`): the test failed after 63 085 ms, with `actual: ''` against the expected `check failed on main (npm test)…`. Caught.
- **Mutation, limit halved** (`limitSeconds * 1000` changed to `* 500`): the test failed with `the merge took 14454 ms`. Caught.
- Both mutations were undone with `git checkout -- packages/delivery/src/merge-checks.ts`. `git status --short` shows a clean tree.

PASS
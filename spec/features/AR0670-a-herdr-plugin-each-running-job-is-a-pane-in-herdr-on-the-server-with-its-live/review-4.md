# AR0670 - Review 4

- Job: 2026-11-10-review-26f655cf
- Branch: arthur/2026-11-09-worker-bafad861
- Commit reviewed: 5dec0126e4777d693be618ee138d12863bfeaaf4
- Verdict: PASS

## Final message

No blocking findings on tip `5dec0126`. The fix for review 3's finding works, the new end-race fix works, and every check I ran reproduces the worker's numbers.

- **Review 3's finding is fixed (`packages/herdr/test/herdr.test.ts:146-155`).** The start-pass test now seeds an `idle` job F that has no tab. It asserts that F gets a tab labelled `worker <short>` that runs `arthur jobs --follow <F>`, that the tab is reported `working` with the message `idle`, and that it is created only once. I deleted `job.state === "idle" || ` from `inRun` in `herdr.ts`, and that test failed (11 pass, 1 fail).
- **The end-race fix is correct (`packages/core/src/job-follow.ts:41-44`).** When the run is over (`over`), the final state line is printed even if `state`'s inode and mtime look unchanged. This is safe because `current()` reads `state` before `reason`, and the run's last move writes `reason` first: once `state` reads `ended`, the reason is already the final one. The line is still printed only once, because of `told(now) !== said`. The follow resolves on the same pass, so the end is never printed twice. `jobs.md:25` ("its last line the final state") now matches the code.
- **The new race test fails without the fix.** It rewrites `state` in place and sets its time back with `utimesSync`, which reproduces the race window. With `over ||` removed, that test fails (5 pass, 1 fail). Over 15 repeated runs of `job-follow.test.ts` with the fix, none failed.
- **The `told(now) !== said` half is now tested.** The test rewrites `state` with the same value under a temporary name and renames it, as a sweep's copy does. With that half removed, the "change of state or reason" test fails after its 20 s wait.
- **The worker's claim that a failed test no longer hangs holds.** The `t.after` in `follow()` removes `home/jobs` when the test ends, which ends the follow. I re-ran a mutant that hung the suite in review 3 (the `seen = …` update removed). This time 2 tests failed in 21 s and the suite exited, with nothing left running from this checkout.
- **Sizes and the commit hold.** `job-follow.ts` is 57 lines. The core budget is 7528, within the 7530 that AR-D589 allows, and the structure test passes. The commit is `fix(AR0670)`.

## Notes
None new. The two `arthur.config.example.ts` survivors were already accepted in reviews 1 to 3 (the known AR0614 limit). F1 to F3 in `findings.md` stay open.

## Checks (all on 5dec0126, in this checkout)
- `npm run check`: tsc, no errors.
- `npm test`: 1708 tests, 1644 pass, 0 fail, 0 cancelled, 64 skipped. Seven files outside the diff print as yellow; none of them is changed by this branch.
- `npm run mutate`: 25 mutants, 23 caught, 2 survived: `arthur.config.example.ts:395: hunk reverted to the base` and `:398: herdr(), => (deleted)`. 410 were not run (`--max 25`); took 375 s.
- Hand mutations, each restored with `git checkout --`. `git status` was clean afterwards:
  - `job-follow.ts`, `over ||` removed: `job-follow.test.ts` 5 pass, 1 fail (the end-race test).
  - `job-follow.ts`, `&& told(now) !== said` removed: 5 pass, 1 fail (the change-of-state test).
  - `job-follow.ts`, the `seen = …` update removed: 4 pass, 2 fail, in 21 s with no hang.
  - `herdr.ts`, the `idle` half of `inRun` removed: `packages/herdr/test/*.test.ts` 11 pass, 1 fail (the start-pass test).
- `job-follow.test.ts` run 15 times in a row: `fail 0` every time.
- `pgrep` found no process left from this checkout. The one `fake-agent.ts` process it found belongs to another job's worktree (`review-b3ea0bff`).
- I did not run real herdr: this checkout cannot reach herdr's socket. The owner still has to do the steps in `packages/herdr/docs/herdr.md` on the server.

PASS
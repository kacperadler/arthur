# AR0629 - Review 3

- Job: 2026-11-05-review-4f5c4b06
- Branch: arthur/2026-11-05-worker-be6656d0
- Commit reviewed: db848680d7f9dbbfabcd4945b21f32cd08657486
- Verdict: PASS

## Final message

No blocking findings. Both earlier reviews' findings are fixed, and a test now catches the removal of each fix. Every Done means point is met: the merge runs detached and survives its parent being killed; a dead lock with an unpushed merge commit is rolled back with the board kept, the lock removed and the merge run again; a live lock is left alone; the checks pass.

**Earlier findings:**
- **review-1 (`packages/delivery/src/merge-recovery.ts:29`, the check that HEAD is the dead job's own merge commit):** fixed. With the check turned off (`if (false && second !== …)`), the rollback test fails (0 pass, 1 fail). Restored with `git checkout`.
- **review-2 (`packages/delivery/src/pass-forward.ts:72`, rerun instead of a wake):** fixed. With the line changed to `code === "" && false`, the rollback test fails (0 pass, 1 fail). The test seeds a dead `merge-runs/<job>-dead` folder next to the dead lock. It asserts exactly one wake, the rerun's, with no `killed before its end`, and that the folder is gone. Restored with `git checkout`.
- **review-2's note on `merging` left behind:** fixed. With the `rmSync(… "merging" …)` line deleted from `merge-recovery.ts`, the rollback test fails (0 pass, 1 fail). Restored with `git checkout`.

The worker's final message matches what I see: commits, files, the line budget at the approved 2195 (AR-D504), and the test counts. `merge-command.ts` changes only one comment and stays at 193 lines, under the yellow zone.

## Notes
- (minor) `packages/delivery/test/review.test.ts:669`: the test name still says the merge runs "as a child". Since AR0629 it runs in its own session, so the name now misleads a little.
- (risk) `packages/delivery/src/pass-forward.ts:45`: no test covers the probe and scope unit names, because this host has no user bus. The owner accepted this.
- (minor) `packages/delivery/src/merge-recovery.ts:37`: the compare-and-swap mutant (`update-ref` without the old value) is not covered, as review-2 already accepted.
- (risk) outside this range: after my checks, a fake agent with `packages/session/src/handoff-extension.ts` was still running (pid 20451, 16 minutes old). It was left by my `npm test` or `npm run mutate` run, not by delivery's merge. I stopped it with `kill 20451`.

## Checks (on db848680)
- `npm run check`: tsc passed with no errors.
- `npm test`: 1555 tests, 1491 pass, 0 fail, 64 skipped. The structure test passed; `packages/delivery/src/merge-command.ts` shows as yellow at 218 lines (line count weighted for width), the same as at the base.
- Hand mutations, the rollback test alone (`--test-name-pattern=rolls.back`): all three mutations above were caught (0 pass, 1 fail each). Each was restored with `git checkout`, and `git status --short` was empty afterwards.
- `npm run mutate -- --max 6`: 6 mutants, 6 caught, 0 survived, 183 not run. I limited it to 6 because the full run hit the 1800 s timeout in the last review. My first try was refused because a hand mutation was still applied; the clean rerun gave this result. Afterwards `pgrep -af "merge --auto"` found no process and the tree was clean.

PASS
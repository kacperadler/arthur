# AR0582 - Review 1

- Job: 2026-11-01-review-4522a2c1
- Branch: arthur/2026-10-31-worker-6cc4fb61
- Commit reviewed: e43db3f6e3a0e86b9a6304583b34f54e2c203a0a
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0582 asks. `test/structure.ts` counts each line as `max(1, ceil(length/160))` toward a file's zone and its package's line budget. `BUDGETS` is re-baselined to the measured counts, as AR-D414 decided, after the AR0600 split that AR-D413 put first. The styleguide gets the Width clause. The new test checks that a 161-character line counts 2, plus the limits at 160, 320 and 321 characters, an empty line, an empty file, a missing final newline, and the step from green to yellow at 200 lines.

## Notes
- (minor) spec/features/AR0582-…/findings.md: six files go yellow, not red, under the width count. `board.ts` is at 203, `cli.ts` 207, `testing.ts` 220, `wrapper.ts` 217, `merge-command.ts` 218 and `restart.ts` 209. Finding F3 records them, so this passes the styleguide.
- (minor) the worker's final message: Done means asks for each named test to be shown failing on the base by reverting the code. This last message doesn't show that; my two mutations below do the same job.

## Checks
- `npm ci`, then `npm run check`: `tsc` reported no errors.
- `npm test`: 1454 tests, 1392 pass, 0 fail, 0 cancelled, 62 skipped. This matches the worker's counts. The six yellow lines printed as expected.
- Hand mutation, `ceil` changed to `floor` in `test/structure.ts`: `node --test test/structure.test.ts` gave 1 fail, so the tests catch it. Restored.
- Hand mutation, `Math.max(1, …)` removed, so empty lines count 0: 1 fail, caught. Restored. `git status --short` printed nothing afterwards.
- `npm run mutate`: not run, to save budget as you asked.

PASS
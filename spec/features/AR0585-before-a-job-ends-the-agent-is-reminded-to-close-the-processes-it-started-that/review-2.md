# AR0585 - Review 2

- Job: 2026-10-30-review-a44e1e4c
- Branch: arthur/2026-10-30-worker-3a3e2dc3
- Commit reviewed: 35998a4c52ed39b7f913b235bf066181c65a4d43
- Verdict: PASS

## Final message

No blocking findings. The merge of main keeps everything main has, and the structure fix is correct.

- **Budget:** `test/structure.test.ts:18` has one `delivery` key, set to 1895. The files under `packages/delivery/src/*.ts` add up to exactly 1895 lines (`wc -l`), so the budget matches what was measured.
- **`delivery.ts` length:** `packages/delivery/src/delivery.ts` is 200 lines, which is the limit.
- **Extension loop:** line 114 loops over `["./checks-extension.ts", "./processes-extension.ts"]`, so both extensions are still registered. Comparing the tip with main (`git diff 48ee4c2c 35998a4c -- packages/delivery/src/delivery.ts packages/core`), that line is the only change.
- **Main's behaviour (AR0576 / AR0589):** it is kept. Line 164 still reads `autoMerge` from `entryOf(host, project)?.pieces?.delivery?.autoMerge`, and lines 172–176 still check the review's `records.delivery`. Both are the same as on main.
- **Merge parent:** the merge's second parent is `b40108f7`, and main at `48ee4c2c` adds only ticket and decision files on top of it. No code from main is missing.

## Notes
- (risk) packages/delivery/src/delivery.ts:114: no test checks that `processes-extension.ts` is registered. I removed it from the loop (mutation: `["./checks-extension.ts"]`) and all delivery tests still passed: 110 pass, 0 fail. `processes.test.ts` loads the extension by its own path, so it never goes through the registration. This gap was already in 1b4fe68, which passed review 1.

## Checks
- `npm ci`: exit 0.
- `npm run check`: exit 0, 0 `error TS` lines.
- `npm test`: exit 0, in the one bash call with the 1800 s timeout. My filter caught no summary lines, so I can't confirm the worker's count of 1401 tests. Nothing in `packages/core/test/limits.test.ts` failed, so I did not need to run it alone.
- `node --test test/structure.test.ts`: all tests pass, including the line-budget test.
- The mutation above: 110 pass, 0 fail. I restored the file with `git checkout -- packages/delivery/src/delivery.ts`, and `git status` shows no changes.

PASS
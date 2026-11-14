# AR0711 - Review 1

- Job: 2026-11-14-review-70ab24b1
- Branch: arthur/2026-11-13-worker-d804912a
- Commit reviewed: f8fb3e6786b616e1973eff01df5aca7e84e2edf3
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0711 asks: `test/mutate.ts` now leaves out package test helpers and `arthur.config.example.ts`, and the new test fails on main.

- **The new filter:** `test/mutate.ts:53-55` matches the ticket's "After" text word for word: the `files` line and its two-line comment.
- **The new test:** the test at `test/mutate.test.ts:80-94` meets the Done means point. I ran it against main's `test/mutate.ts` and it failed: 26 mutants, 9 caught, 17 survived, the extra survivors all in `packages/a/test/helper.ts:2` and `arthur.config.example.ts:1`. On the branch's version it expects 12 mutants, 9 caught, 3 survived.
- **Every exclusion is tested:** the test also changes a root `.test.ts` and a `.d.ts`, so dropping any one exclusion makes it fail. I tried one by hand: I changed `(test|d)` to `(test)` and got 16 mutants and 7 survived, the 4 extra in `limit.d.ts`. I restored the file with `git checkout -- test/mutate.ts`.
- **The out-of-Scope change** to `packages/activity/test/log-command.test.ts:217-220` is explained in the worker's message, and the problem is real. Main's version of that file fails on its own today: 10 pass, 1 fail, `no activity to show on 2026-11-13`. Without the fix, `npm test`, which Done means requires, would fail on any date after 2026-11-13. The fix only changes the test: nothing in `src/` changes. F1 in `findings.md` already records it.
- **Docs:** no doc, README, role or roadmap line describes which files mutate selects, so nothing goes stale.
- **Shape:** no new files under `src/`, no dependencies, no boundary crossed. The `files` line is longer than 160 characters, so it counts as 2 lines; the ticket prescribes that exact text.

## Notes
- (minor) packages/activity/test/log-command.test.ts:220: the test reads only the day the message was filed under. If the message and the reply are stamped on either side of midnight in Warsaw, the reply lands in the next day's file and the test fails once. The chance is tiny.

## Checks (on f8fb3e67)
- `npm run check && npm test`: tsc reported no errors. `npm test` had 1 fail and 64 skipped. The failure was `packages/uptime/test/uptime.test.ts:343` ("waited 20 s for the first checks"), a file the diff does not touch.
- `node --import @arthur/core/testing --test packages/uptime/test/uptime.test.ts` run alone: 25 pass, 0 fail. So the failure does not count against the branch (verify.md step 2).
- `npm run mutate`: 12 mutants, 12 caught, 0 survived. That is every mutant on the branch, under the 100 cap.
- The new test against main's `test/mutate.ts`: 0 pass, 1 fail (26 mutants, 17 survived). Restored afterwards.
- The new test with `(test|d)` changed to `(test)`: 0 pass, 1 fail (16 mutants, 7 survived). Restored afterwards.
- `packages/activity/test/log-command.test.ts` at main's version: 10 pass, 1 fail. Restored afterwards; `git status --porcelain` is empty.

PASS
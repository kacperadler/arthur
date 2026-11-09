# AR0662 - Review 1

- Job: 2026-11-09-review-5e94a54a
- Branch: arthur/2026-11-09-worker-cca808fc
- Commit reviewed: eb6fd8cebbaa1ded161c32062acf0b4521328b98
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0662 asks: a checks call with bash `timeout: 0` now keeps `0` (no deadline) instead of being raised to 1800.

- **`packages/delivery/src/checks-extension.ts:28`** now returns `input?.timeout === 0 ? 0 : Math.max(<number or 0>, 1800)`. Only the number `0` is kept. No timeout, `300` and `1799` still become 1800, and `2400` is kept. `-1` and the string `"0"` are tested and become 1800.
- **Tests in `packages/delivery/test/checks.test.ts`** cover all three Done-means cases. The `0` case is tested both for `npm test` (line 211) and for the ticket's exact `npm run mutate -- --max 25` call (lines 232–233). When I put the old line 28 back by hand, those two tests fail, so the `0` case fails on the old code as the ticket requires.
- **`packages/delivery/docs/commands/review-needed.md:35`** now says `0` is kept and omp runs it with no deadline. I searched the repo for "at least 1800", "raised to 1800" and "no deadline": no other line contradicts the change. The roles' and `verify.md`'s "timeout of 1800 seconds" rule is still true.
- **Size and boundaries:** the diff stays inside the ticket's Scope In. The file stays green and the structure test passes. The worker's change to destructure the event is explained in its final message (it keeps delivery inside its 2220-line budget), and behavior is unchanged.
- **Worker's claims:** every one I checked matches my results: the test counts, the 20/18/2 mutate summary, the two surviving mutants, and the 13/15 run with the old code.

## Notes
- (minor) packages/delivery/src/checks-extension.ts:28: two mutants survive that no test can catch. Changing the fallback `: 0` to `: 1` or `: -1` makes no difference, because `Math.max(…, 1800)` gives 1800 either way, so the two mutants survive. The worker named them, as the review-needed gate allows. Writing it as `typeof input?.timeout === "number" ? Math.max(input.timeout, 1800) : 1800` would remove the fallback and its two survivors, so mutate would end with 0 survived. The ticket's "mutate passes" could be read as asking for that.

## Checks (run on eb6fd8ce)
- `npm run check && npm test`: `tsc` clean. The first run's output was filtered without the summary, so I ran `npm test` again for the counts: tests 1647, pass 1583, fail 0, cancelled 0, skipped 64. The structure test passes, and its yellow lines are all files the diff does not touch.
- `npm run mutate -- --max 25`: `mutate: 20 mutants, 18 caught, 2 survived`. 20 is all the mutants the change has, so it meets the min(25, all) rule. The two survivors are the `: 0` → `: 1` / `: -1` fallback mutants above.
- Old line 28 put back by hand (`timeout: Math.max(...)` without the `0` check), then `node --import @arthur/core/testing --test packages/delivery/test/checks.test.ts`: tests 15, pass 13, fail 2. The two failures are the timeout test and the mutate test. I restored the file with `git checkout --`, and `git status` was clean afterwards.

PASS
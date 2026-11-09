# AR0658 - Review 2

- Job: 2026-11-09-review-dbc2c0f6
- Branch: arthur/2026-11-08-worker-54bdf673
- Commit reviewed: 089a7128036564cb11d73ee1d0f018e982c13fbe
- Verdict: FAIL

## Final message

**Finding 1: one hand mutation of a key behavior survives the tests, so this fails.**

## Findings

1. **`test/mutate.ts:217`: no test checks that a hang still counts as caught rather than cut by the deadline.** I removed the condition `&& left < RUN_MS`, leaving `signal === "SIGKILL" ? undefined : false`. All 8 tests in `test/mutate.test.ts` still passed.
   - **What breaks:** with that mutation, a SIGKILL of a test run when plenty of time is left counts as cut by the deadline. That covers the 600 s `RUN_MS` cap, which `test/mutate.ts:13` says a hanging mutant counts as caught for. The mutant becomes not run, the loop `break`s, and every later mutant is reported as `not run (time)` with up to 25 minutes still left. Any branch with one hanging mutant would get a short run, and a summary that blames time.
   - **Proof:** I added a throwaway test whose same-name test kills its runner with `process.kill(process.ppid, "SIGKILL")`, run with `--max 2` and the real clock.
     - Unmutated, it passes: `mutate: 2 mutants, 2 caught, 0 survived; 10 not run (--max 2)`.
     - Mutated, it fails, and the run prints `mutate: 0 mutants, 0 caught, 0 survived; 2 not run (time); 10 not run (--max 2)`.
     - The test takes about 0.5 s. I removed it and restored the file afterwards.
   - **Why it fails the branch:** this condition is new code from this branch, and it is the only thing that tells the deadline's cut from a hang. The review criteria count a removed condition of a key behavior that no test catches as a FAIL. A test like the probe above, kept in `test/mutate.test.ts`, would pin it.

## Notes
- (risk) test/mutate.ts:217: any SIGKILL in the last 600 s still counts as the deadline's cut. This is F3, already filed in `findings.md` and left open.
- (bug) packages/delivery/src/checks-extension.ts:77: the regex reads only the first `not run` part. This is F1, and the ticket's Out keeps that file off this branch.
- (minor) test/mutate.ts:72: changing `break` to `continue` survives, but it behaves the same under a real clock.
- (minor) test/mutate.ts: the file grew from 211 to 226 lines, which would be red. `test/structure.ts` does not size root `test/` files, so no zone check applies, and the final message gives no reason for the growth.
- (minor) The worker's fix for review-1's finding holds. The bound in `late()` makes the deadline-cut test fail at 60097 ms when `Math.min(RUN_MS, left)` becomes `RUN_MS`.

## Checks (on 089a7128)
- `npm run check`: tsc clean.
- `npm test`: tests 1650, pass 1586, fail 0, cancelled 0, skipped 64, exit 0. My first run's filter dropped the summary lines, so these counts are from a second run.
- `npm run mutate` (timeout 3600): `mutate: 25 mutants, 25 caught, 0 survived; 31 not run (--max 25)`, exit 0, 500 s. Afterwards `pgrep -af limit.test.ts` printed nothing.
- Hand mutations, each run with `node --import @arthur/core/testing --test test/mutate.test.ts` and restored with `git checkout -- test/mutate.ts`:
  - **`Math.min(RUN_MS, left)` → `RUN_MS`:** 7 pass, 1 fail. The deadline-cut test failed at 60097 ms. This run was concurrent with the next mutation, so the file held both mutations at the time.
  - **`&& left < RUN_MS` removed, alone:** 8 pass, 0 fail. It survived; this is finding 1.
  - **The probe test above:** passes unmutated, fails mutated.
- `git status --short` was empty after the restores.

FAIL
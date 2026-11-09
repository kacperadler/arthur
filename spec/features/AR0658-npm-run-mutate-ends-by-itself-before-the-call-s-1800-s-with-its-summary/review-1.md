# AR0658 - Review 1

- Job: 2026-11-09-review-ba7bd630
- Branch: arthur/2026-11-08-worker-54bdf673
- Commit reviewed: d24066a8125478551b5256c4e72a374b8e7974aa
- Verdict: FAIL

## Final message

The deadline works as the ticket asks, but one mutation of a key behavior survives, so this fails.

## Findings

1. **`test/mutate.ts:211`, the deadline's cut of a running test run is not pinned.** I changed `timeout: Math.min(RUN_MS, left)` to `timeout: RUN_MS`, and the test "a mutant whose tests the deadline cuts is not run, not caught; its file is back and its tests stopped" still passed. It took 600142 ms instead of about 2 s.
   - The test only checks how the mutant is counted. With this mutation the 600 s cap kills the run instead, and `left < RUN_MS` still counts it as not run, so the summary is the same.
   - This cut is the ticket's guarantee. Without it, a mutant that starts at 1499 s and hangs runs until 2099 s, past the 1800 s kill the ticket exists to beat (Goal; Done means point 2).
   - `test/mutate.test.ts` sets no `timeout`, so `npm test` passes with the cut removed. The review criteria count a key-behavior mutation the tests miss as a FAIL.
   - Fix: give that test a bound, for example `{ timeout: 60_000 }`, or assert how long `late(...)` took.

## Notes
- (risk) test/mutate.ts:217: Any SIGKILL in the last 600 s counts as a deadline cut. `signal === "SIGKILL" && left < RUN_MS` counts a SIGKILL from anywhere else in that window (the OOM killer, a mutant that kills its own group) as not run. The loop then stops and calls the rest `not run (time)`. Checking `Date.now() >= end` at exit would name the cause exactly.
- (risk) test/mutate.test.ts:107: A mutate run leaves a blocking fixture test running. My `npm run mutate` left group 4054672 behind: `limit.test.ts` with `blocked.pid` in `/tmp/arthur-test-0Il4hX/tmp/folder-dodVo8`, 937 s old, parent 817. It reproduces F2 / AR0637 F1. Both blocking tests write the same fixture, so I could not tell which one leaked. I killed it with `kill -KILL -- -4054672`.
- (bug) packages/delivery/src/checks-extension.ts:77: The regex reads only the first `not run` part (worker's F1). Outside this ticket's scope, and filed in findings.md.
- (minor) test/mutate.ts:69: `break` → `continue` survives (8/8 pass). It behaves the same under a real clock, because once the deadline has passed the loop check gives `undefined` anyway.
- (minor) test/mutate.ts: The file grew from 211 to 226 lines. `test/structure.ts` does not size root `test/` files, so no zone check applies. Most of the growth is the ticket's own After code.
- (minor) findings.md F2: It says "two `npm run mutate` runs"; the final message says three.

## Checks (on d24066a8, clean tree)
- `npm run check`: tsc clean.
- `npm test`: tests 1650, pass 1586, fail 0, cancelled 0, skipped 64. This matches the worker's numbers.
- `npm run mutate`: `mutate: 25 mutants, 25 caught, 0 survived; 31 not run (--max 25)`, in 1032 s. This matches the worker's numbers; afterwards one fixture group was left running (see Notes).
- Hand mutations, each run with `node --import @arthur/core/testing --test test/mutate.test.ts` and restored with `git checkout -- test/mutate.ts`:

| Mutation | Result |
|---|---|
| Loop deadline check removed | 6 pass, 2 fail (caught) |
| Deadline SIGKILL counted as caught (`... ? undefined : false` → `false`) | 7 pass, 1 fail (caught) |
| `if (left <= 0) return ...` removed | 7 pass, 1 fail (caught) |
| `late > 0` → `late >= 0` | 5 pass, 3 fail (caught) |
| `break` → `continue` | 8 pass (survived, same behavior under a real clock) |
| `Math.min(RUN_MS, left)` → `RUN_MS` (deadline-cut test alone) | 1 pass, 600 s (survived: finding 1) |

- `git status --short` was empty after the restores.

FAIL
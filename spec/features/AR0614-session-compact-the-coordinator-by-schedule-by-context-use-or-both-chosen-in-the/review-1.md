# AR0614 - Review 1

- Job: 2026-11-04-review-d185a63d
- Branch: arthur/2026-11-04-worker-b8b7460d
- Commit reviewed: 7089d96f23a01a09095287fe33dc051cf783777f
- Verdict: PASS

## Final message

No finding blocks the merge. The branch does what the AR0614 ticket asks, follows the approved plan, and `npm run check && npm test` pass on 7089d96f.

**What the code does**
- **Options:** `session-options.ts:27-32` adds `compactOn` (`"schedule"` by default, `"context"`, `"both"`) and `compactAtPercent` (a whole number from 1 to 99, default 80). Bad values are refused through the existing `checkOptions` loop, naming the option.
- **Trigger:** `compactions()` in `session.ts:97-130` reads `context-use` once per tick and deletes it. A reading at or above the threshold writes the same `request.json` through the shared `ask()`, so a context compaction behaves like a scheduled one: handoff first, withdrawal on a failed write, and the `compactWaitSeconds` wait. An `armed` flag stops a second request; only a `compact: done` outcome or a reading below the threshold allows the next one. The skip, withdrawal and "both" behaviour match the plan, which the owner approved with its open questions (AR-D483).
- **Turn extension:** `turn-extension.ts:34-39` writes the percent at each real turn end, using a temporary name then a rename. It writes nothing when the context window is 0, the percent is not a number, or the API is missing. With `"context"` alone, `compactAt` is emptied.
- **Jobs untouched:** the new test in `restart-guard.test.ts` launches a worker under each of the three triggers. The launches are identical, and none loads either session extension.
- **The worker's two departures** (the job test's file, the roadmap line) are each explained in its final message.

**Line budget, 917 → 953 (+36, the plan said about 30, so about 947):** every added line has a job, so I don't count it against the branch.
- `ask()` (+8) is needed so both triggers share the "never queue a second request" rule.
- The `armed` handling and reading the file take about 7.
- The `compactAtPercent` table entry takes 4 lines where one long line would count 2 (−2 possible).
- `Usage`/`Ctx` became their own types (about +2 over one long line).
- Header comments add 3 lines on the plugin's behaviour and the room for project agents, as Done means 4 asks.

At most 3 to 4 lines could be squeezed out. The gap from the estimate is within a rough estimate, and nothing is padding. The raise belongs in outcome.md.

## Notes
- (risk) `packages/session/src/turn-extension.ts:34-39`: the `context-use` write runs before the failure logic without creating the folder first. If `ARTHUR_SESSION_FOLDER` does not exist, the write throws, and that turn's failure notice would be lost. `leave()` creates its folder with `mkdirSync(..., { recursive: true })`.
- (minor) `packages/session/src/session-options.ts:28-32`: the `compactAtPercent` entry on 4 lines could be one line counting 2, giving back 2 budget lines.
- (minor) `packages/session/src/session.ts:122`: the slot carries the raw percent (`context 83.51234%`) rather than a rounded `<n>`; it only shows in the outcome line.
- (minor) `test/mutate.ts:174`: the worker's F1 holds. A change to a root file never runs a package's tests, so the `arthur.config.example.ts` mutant is reported as surviving even though the new example-config test catches it.

## Checks (on 7089d96f)
- **`npm run check && npm test`** (one call, timeout 1800): tsc clean; `ℹ tests 1513`, `ℹ pass 1449`, `ℹ fail 0`. The structure test passes with `session: 953`, and the only yellow session file is `restart.ts`, which the range does not touch.
- **Hand mutations:** I did not run `npm run mutate`, to save budget. Instead I made 8 mutations of the key behaviours and ran `session.test.ts` and `start-notice.test.ts` after each. Every one made at least one test fail (`ℹ fail ≥1`):
  1. Allowing a new request after `compact: done` removed.
  2. The `compactOn !== "schedule"` guard removed.
  3. `percent < compactAtPercent` turned into `<=`.
  4. Removing `context-use` at start dropped.
  5. A reading below the threshold no longer allows a new request.
  6. The `armed` check removed from the request.
  7. The `contextWindow > 0` check removed.
  8. `"context"` no longer turns the schedule off.

  Each file was restored with `git checkout -- packages/session/src`, and the tree was clean afterwards.

PASS
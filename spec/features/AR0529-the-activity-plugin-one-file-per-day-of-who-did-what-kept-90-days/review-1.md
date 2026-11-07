# AR0529 - Review 1

- Job: 2026-11-06-review-1635f9f4
- Branch: arthur/2026-11-06-worker-d652f2fb
- Commit reviewed: b3978db5c870d9ca852fb078f9bfb0522ac75b82
- Verdict: FAIL

## Final message

## Findings

1. **packages/activity/src/activity.ts:72: a mutation that loses a line survives the tests.** I changed `next > last + 1` to `next > last + 2` and all 15 activity tests still pass. The only gap the tests use is four events wide: the last line is 1 and the next held event is 6, in the test at `packages/activity/test/activity.test.ts:89-106`. With the mutation, a gap of exactly one event is never read from the log. For example, the last line is 1, the next held event is 3, and the lost event 2 is never written. One lost delivery is the most common gap, and "a gap filled once" is a Done means point. This is the limit moved by one that the review criteria count as a FAIL. The fix is a test where one logged event is missing between the last line and the first held event, and that event gets written.

The rest of the branch meets the ticket and the AR0527 plan:
- The package was made with budget 350.
- It subscribes to the plan's §2 event list. `job-state` is logged only when it goes to `blocked` or `ended`.
- Text is cut at 300 characters by code point. A forward becomes `[forwarded, N chars]`, and media parts have no path.
- The day is taken in `core.timeZone`. Only `start` writes, a replay is skipped by `seq`, and a cut last line gets its line break first.
- `keepDays` retention runs at `start` and at each new day.

The event field names match `docs/plugin-api.md:183-205`. The forward mark matches `telegram/src/media-in.ts:44` and `discord/src/receive.ts:84`. No boundary breaks, and every source file is green (91, 76 and 52 lines).

## Notes
- (risk) packages/activity/src/day-files.ts:49: a very large `keepDays` crashes `arthur run`'s start. `checkOptions` accepts any whole number, but a value of about 1e8 or more makes `toISOString()` throw `RangeError: Invalid time value` (checked with `node -e`, `keepDays` 2e8).
- (minor) packages/activity/src/activity.ts:7: comments and the plugin's page cite "spec/roadmap.md, entry 100", but that entry does not exist yet. The worker's F2 already covers this.
- (minor) README.md:54: activity is missing from the README's list of built plugins, and the diagrams have no `activity` node. Both are recorded as F1 and F2 in `findings.md`.
- (minor) packages/activity/src/activity.ts:72: the gap check reads the whole log on most starts. The next held logged event usually follows events that are not logged (`job-steered`, `doctor`), so it rarely sits right after the last line. `docs/activity.md` states this.

## Checks (on b3978db5)
- `node --import @arthur/core/testing --test packages/activity/test/*.test.ts`: 15 tests, 15 pass, 0 fail.
- 29 mutations by hand on `activity.ts`, `activity-line.ts` and `day-files.ts`, each restored with `git checkout -- <file>`, tree clean afterwards:
  - 27 were caught: the replay skip, the gap read, both prunes, the prune boundary, the cut line, the sort, the time zone, the forward mask, the `job-state` filter, the cut limit, the media seconds, the job's kind and ticket, and others.
  - 1 survived: the gap limit `+1` to `+2`, the finding above.
  - 1 survived but changes nothing: dropping `last !== undefined` from the gap check, since `undefined + 1` is `NaN` and the comparison is false either way.
- I did not rerun `npm run check`, `npm test` or `npm run mutate`, as the owner asked. The worker's mutate run stopped after 25 mutants, all in `arthur.config.example.ts`, so it never reached the plugin's source; the mutations by hand above cover that.

FAIL
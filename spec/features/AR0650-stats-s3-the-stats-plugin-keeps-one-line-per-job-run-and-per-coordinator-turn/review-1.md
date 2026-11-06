# AR0650 - Review 1

- Job: 2026-11-06-review-864cf9e7
- Branch: arthur/2026-11-06-worker-a83f424b
- Commit reviewed: d4d367f31c1389eacf3c02a3ba0ddb87e0c0271c
- Verdict: PASS

## Final message

## Findings

None block the merge. The diff covers every S3 point of the AR0480 plan (Approach §1–§2, Files for 109), and each "How to test" line for 109 has a test in `packages/stats/test/stats.test.ts`:
- An end heard before `start` is written at `start`; a process that never starts writes nothing.
- A replayed `seq` is skipped, and a second end of the same run adds 0.
- A job whose record is gone gets a `missing: true` line.
- The backfill happens once.
- The extension writes one line per real end of a turn and counts nothing twice across a resume, a restart and a subagent turn.

The docs named in the plan's Files are updated, and stats' budget is 200, the number AR-D523 sets. The worker gave reasons for its two departures from the plan:
- **Unreadable lines are not counted:** they are skipped without a count, and the views in 111 will count them.
- **No README Features line:** README.md is at the 120-line cap that `test/structure.test.ts` enforces. The worker filed this as F1.

Boundaries hold: stats imports only `@arthur/core/option-table`, `@arthur/core/plugin` and `@arthur/core/testing`, and writes only to its own folder. It has no runtime dependency, class or enum. Source files are 82, 40 and 51 lines, all green.

## Notes
- (risk) packages/stats/src/stats.ts:53: a hand-deleted event log stops job lines silently. The core restarts `seq` numbering when `events.jsonl` is cut or deleted (`run.md`; `job-states.test.ts:277`, "the numbers start again"). `seq <= last` then skips every `job-ended` until the new numbers pass the old highest. The plan asks for this rule; orchestration keys on `seq` plus `time` for this reason.
- (risk) packages/stats/src/stats.ts:75: a crash in the middle of the backfill leaves it half done forever. The first `put` creates `runs.jsonl`, so the next start sees the file and never backfills the rest.
- (minor) packages/stats/src/stats.ts:55: an end waiting until `start` reads the record at `start`. If the job has been continued in between, `seconds` already holds part of the current run. Totals stay right, but time shifts between lines.
- (minor) packages/stats/src/stats-lines.ts:33: no test catches removing `!Array.isArray(value)`. A hand-edited array line would be read as a line with no job and `seq` 0.
- (minor) README.md:31: the Features list promises one line per package, and stats has none (finding F1, disclosed).

## Checks (on d4d367f3)
- I did not rerun `npm run check`, `npm test` or `npm run mutate`; the owner said not to, and the worker recorded them on this commit.
- `node --import @arthur/core/testing --test packages/stats/test/stats.test.ts test/structure.test.ts test/option-tables.test.ts`: 32 tests, 32 pass, 0 fail.
- I made 18 hand mutations, each with sed, then the stats test file alone, then `git checkout -- <file>`. The tree was clean afterwards.
  - **Caught (17):**
    - In `stats.ts`: `seq <= last` changed to `<`, the `hold === ""` part of the filter removed, the `idle` part of the filter removed, the ticket regex changed to `\d{5,}`, the start's `readLines(runs).forEach(count)` removed, the delta replaced by the whole total, the backfill run on every start, and `missing: true` changed to `false`.
    - In `session-extension.ts`: the `willContinue` return removed, `sub !== true` changed to `true`, the `> until` filter removed, the `started` reset removed, `??=` changed to `=`, and `hasUI` forced true.
    - In `stats-lines.ts`: the torn-line break disabled, and the `ENOENT` check inverted.
  - **Survived (1):** removing `!Array.isArray(value)` in `stats-lines.ts:33`, listed in the notes as minor.

PASS
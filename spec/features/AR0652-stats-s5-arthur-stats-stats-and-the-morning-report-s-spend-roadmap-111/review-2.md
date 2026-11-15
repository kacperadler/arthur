# AR0652 - Review 2

- Job: 2026-11-13-review-e56c8df9
- Branch: arthur/2026-11-13-worker-e7442a45
- Commit reviewed: 9359140d7528485b79bf795df40515f5b3d74aee
- Verdict: PASS

## Final message

No blocking findings. The four findings from review-1 are now covered by tests. The code is the same as at `04b236c3`; commit `9359140d` changes only `packages/stats/test/spend.test.ts`. That diff matches the worker's message: AC0015 on the board, the new "whether it pays" test, the full-line `/stats AC0012 30d` check, and the job test expecting `2 merged tickets`.

## Notes
- (minor) `packages/stats/src/spend.ts:34`: no test covers a span holding only subagent turns. Changing `turns > 0 || runs.length === 0` to `turns > 0` breaks no stats test (0 fail). With only subagent turns in the span, the total line would print an empty count (`…at list price, , 0h00m`).
- (minor) `packages/stats/src/spend.ts:41`: changing `ordered ? 0` to `ordered ? 1` survives, but the output can't change. The "By day" groups are built from rows already sorted by time, so dates already come out in order.

## Checks (on 9359140d)
- **`npm run check`:** tsc clean.
- **`npm test`:** 1814 tests, 1750 pass, 0 fail, 64 skipped (678 s).
- **`npm run mutate`:** 100 mutants, 91 caught, 9 survived. They are the same 9 as in review-1 and the worker's message:
  - 2 of the `summary` line in `stats.ts:17`.
  - 2 of the `unread` default in `stats-lines.ts:24`.
  - 1 deletes `inJob: true` (`stats-command.ts:21`). Review-1 showed that `test/job-gate.test.ts` catches it.
  - 4 of the `/stats` menu text (`stats-command.ts:23`).
- **Review-1's mutations, by hand:** after each one I ran `node --import @arthur/core/testing --test packages/stats/test/*.test.ts`, and each now fails 1 test (20 pass):
  - `&& inSpan(…ticket.updated)` removed from `merged`.
  - `limit:` dropped from the `failed` regex.
  - The division without `count > 0`.
  - `kept.toSorted(…)` replaced by `kept`.
  - `row.missing ? [] :` removed.
- **Other hand mutations:** 22 more, each with the stats tests. 20 were caught (1 to 5 fail each):
  - `spent === 0` → `< 0`.
  - `row.sub ? 0 : row.seconds`.
  - `row.turn && !row.sub`.
  - `unread > 0`.
  - `"dropped"` → `!== "merged"`.
  - The no-ticket filter.
  - The top-tickets sort reversed.
  - The `--role` filter removed.
  - The `<n>d` regex: `[0-9]` instead of `[1-9]`, and `\d{0,5}` instead of `\d{0,4}`.
  - `>=` → `>` on both span checks.
  - The `.jsonl` filter.
  - The `--model` cost.
  - `line.sub`.
  - `line.session` as a turn's role.
  - The `/stats` extra-words refusal.
  - The `"7d"` default.
  - The `stats tickets` extra-argument refusal.
  - The `TICKET` regex `\d{4,}` → `\d{3,}`.
  - The share condition `> 1` → `> 0`.

  The 2 that survived are in the notes above. Every file was restored with `git checkout --`, and `git status` is clean.
- **Search for stale `arthur stats` wording:** the only places still calling the report bare `arthur stats` are dated records. Those are the CHANGELOG, `docs/plugin-api.md:139` (already in review-1's notes), and roadmap entries 61 and 110. Nothing current is stale.

PASS
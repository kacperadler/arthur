# AR0652 - Outcome

- Merged: 2026-11-13, `46655571`
- Branch: arthur/2026-11-13-worker-e7442a45
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $8.74, reviews $2.14; review rounds 2

## What went in

- packages/stats/src/spend-read.ts: reads `runs.jsonl` and `sessions/*.jsonl`, parses `--since` in `core.timeZone`, applies the filters, and counts lines it cannot read
- packages/stats/src/spend.ts: the spend views: full, `/stats` short, and one ticket's runs
- packages/stats/src/stats-command.ts: registers `arthur stats`, `arthur stats tickets` and `/stats`, with usage lines and the in-job refusal
- packages/stats/src/stats.ts: uses `statsCommand`; header and setup summary name entry 111
- packages/stats/src/stats-lines.ts: `readLines` counts the lines it skips in `unread`
- packages/stats/src/tickets.ts: header names `arthur stats tickets` and its doc page
- packages/stats/docs/commands/stats.md: the spend view's page (filters, sections, `/stats`, refusals)
- packages/stats/docs/commands/stats-tickets.md: the merged tickets' report page, moved from `stats.md`, now under `tickets`
- packages/stats/docs/stats.md: describes entry 111 and `arthur stats tickets`
- packages/stats/test/spend.test.ts: tests of the spend view: each filter, `--since` limits, empty folder, unread lines, merged in the span, limit stops, none merged, run order, `/stats` and the in-job refusal
- packages/stats/test/tickets.test.ts: the report tests run `stats tickets`
- packages/stats/test/stats.test.ts: a session file ending in `null` and `[1]` keeps the `until` before them
- packages/orchestration/roles/coordinator/morning-report.md: section 6, Spend
- packages/orchestration/evals/morning-report/scenario.json: stub for `^arthur stats`; the Spend line expected in the reply
- packages/orchestration/docs/commands/coordinator.md: the report has six sections, Spend last
- packages/develop/test/scenarios.test.ts: the morning-report replay calls `arthur stats --since 1d` and replies with Spend
- packages/core/docs/commands/help.md: in-job list says stats runs only `tickets` and refuses the spend itself
- packages/manage/docs/manage.md: `### Stats` and the intro name `arthur stats tickets`
- test/job-gate.test.ts: in a job, `stats` exits 1 with its refusal and `stats tickets` runs
- test/structure.test.ts: stats budget 531
- docs/plugin-api.md: the `stats.tickets` row names `arthur stats tickets`
- docs/setup.md: the stats line names `arthur stats`, `/stats` and `arthur stats tickets`
- README.md: the stats feature line names the spend views and `arthur stats tickets`
- arthur.mmd: the stats node shows the views built and usage windows planned
- arthur.config.example.ts: the `stats()` comment names `arthur stats`, `/stats` and `arthur stats tickets`
- spec/features/AR0652-stats-s5-arthur-stats-stats-and-the-morning-report-s-spend-roadmap-111/findings.md: F1, uptime's offline test times out under full-suite load

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1743/1814 passed.

## Left open

- Deferred (client summary): F1. Uptime's "this machine offline" test hits its 20 s limit under the full suite's load

# AR0651 - Outcome

- Merged: 2026-11-13, `a27b618c`
- Branch: arthur/2026-11-13-worker-40659c2f
- Reviews: review-1.md PASS
- Cost: worker $5.01, reviews $1.37; review rounds 1

## What went in

- `packages/stats/src/tickets.ts`: the merged-ticket report (moved from `packages/manage/src/stats.ts`), as `ticketStats(host, project, since?)`, with the merged filter inside it.
- `packages/stats/src/stats.ts`: registers `arthur stats` (`inJob: true`) and provides `stats.tickets`; the header names entry 110.
- `packages/stats/test/tickets.test.ts`: the moved report tests (imports, fake-host name and the returned runner adjusted, assertions unchanged), plus `stats.tickets` (project, `since` edge, time zone, 100% share) and table-driven rows for the finding-line rules.
- `packages/stats/test/stats.test.ts`: a second load on the same fake host registers no command, as a separate process would not.
- `packages/stats/docs/commands/stats.md`: the moved page; it says the stats plugin provides the command (entries 61 and 110), names `stats.tickets`, and gives the `since` message.
- `packages/stats/docs/stats.md`: describes entry 110 (`arthur stats`, `stats.tickets`).
- `packages/manage/src/manage.ts`: the `stats` command and its import are gone; the header lists entries 60 and 62 to 64.
- `packages/manage/src/audit.ts`: `### Stats` comes from `collect("stats.tickets", project, window)`, or reads "not loaded"; the merged-since filter for deferred findings is inline.
- `packages/manage/src/retro.ts`: `### Stats` comes from `collect("stats.tickets", project, made)`, or reads "not loaded".
- `packages/manage/test/audit.test.ts`: the test provides `stats.tickets`; adds the window it is asked with, the "not loaded" line, and a ticket merged exactly at the window's start.
- `packages/manage/test/retro.test.ts`: the test provides `stats.tickets`; adds the "not loaded" line and the `since` taken from the last retro's commit.
- `packages/manage/docs/manage.md`: intro and both `### Stats` lines say the section comes from the stats plugin.
- `packages/manage/src/stats.ts`, `packages/manage/test/stats.test.ts`, `packages/manage/docs/commands/stats.md`: moved to stats (gone from manage).
- `docs/plugin-api.md`: a `stats.tickets` row in "Provided names" and an AR0651 entry under "Changes since entry 51".
- `packages/core/docs/commands/help.md`: the in-job list says `stats` (stats).
- `test/job-gate.test.ts`: loads the stats plugin, which now owns `arthur stats`.
- `test/structure.test.ts`: budgets manage 1476, stats 303.
- `README.md`, `arthur.mmd`, `docs/setup.md`, `arthur.config.example.ts`: `arthur stats` listed under stats, removed from manage.
- `spec/roadmap.md`: entries 61 and 110 say manage keeps the merged-since filter of the audit's deferred findings (inlined, not `mergedSince`).
- README.md: not described
- arthur.config.example.ts: not described
- arthur.mmd: not described
- docs/setup.md: not described
- packages/manage/docs/commands/stats.md: not described
- packages/manage/src/stats.ts: not described
- packages/manage/test/stats.test.ts: not described

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1735/1806 passed.

## Left open

- Findings: none; no findings.md on this ticket.

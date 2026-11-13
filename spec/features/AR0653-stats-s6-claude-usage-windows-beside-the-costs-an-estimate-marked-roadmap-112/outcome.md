# AR0653 - Outcome

- Merged: 2026-11-13, `234b6360`
- Branch: arthur/2026-11-13-worker-6d262270
- Reviews: review-1.md PASS
- Cost: worker $3.72, reviews $1.09; review rounds 1

## What went in

- packages/models/src/usage.ts: a window keeps `durationMs` when the report gives a positive number.
- packages/models/src/models.ts: provides `models.windows` (each window with its provider, or one line saying why there is none); the header comment names it.
- packages/models/test/models.test.ts: tests `models.windows` (length present, missing, 0, text, 1 ms; no reset; no report; a failed fetch; a report without accounts).
- packages/models/docs/models.md: describes `models.windows`.
- packages/stats/src/windows.ts: new; the `arthur stats windows` view.
- packages/stats/src/stats-command.ts: routes `windows`, with its usage refusal and the in-job refusal.
- packages/stats/src/spend.ts: exports `money` for `windows.ts`.
- packages/stats/src/stats.ts: the header comment names entry 112 and `windows.ts`.
- packages/stats/test/spend.test.ts: tests `arthur stats windows` (span with and without a reset, no span, provider filter, the span's start boundary, tie order, not loaded, no report, no window, wrong usage, inside a job).
- packages/stats/docs/commands/stats-windows.md: new; the page `arthur stats windows --help` prints.
- packages/stats/docs/commands/stats.md: the usage line and refusals name `windows`.
- packages/stats/docs/stats.md: a paragraph for roadmap entry 112.
- docs/plugin-api.md: the AR0653 entry under "Changes since entry 51" and a `models.windows` row in Provided names.
- docs/setup.md: the stats line names `arthur stats windows`.
- README.md: the stats line names `arthur stats windows`.
- arthur.config.example.ts: the stats comment names `arthur stats windows`.
- arthur.mmd: the stats box shows `arthur stats windows` instead of "usage windows planned".
- test/job-gate.test.ts: `arthur stats windows` inside a job exits 1 with the refusal.
- test/structure.test.ts: budgets raised, models 546 and stats 575.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1746/1817 passed.

## Left open

- Deferred (client summary): F1. a time outside the range `Date` accepts crashes the view
- Deferred (client summary): F2. a window for one model tier (`tier: true`, e.g

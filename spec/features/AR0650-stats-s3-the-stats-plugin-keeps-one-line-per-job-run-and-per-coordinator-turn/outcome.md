# AR0650 - Outcome

- Merged: 2026-11-07, `51b51061`
- Branch: arthur/2026-11-06-worker-a83f424b
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $10.30, reviews $1.12; review rounds 2

## What went in

- README.md: a `stats` line in the Features list linking `packages/stats/docs/stats.md`; the diagram's "Arthur itself" box names stats; two "Read more" lines joined into one, to stay at 120 lines
- arthur.config.example.ts: lists stats among the built plugins, its import, and a `stats()` entry with its comment
- arthur.mmd: a stats node, marked partly built, and "stats has entry 109 of 109-112" in the status line, beside main's uptime entries
- docs/architecture/core-and-plugins.mmd: a stats node in "Arthur itself", marked first version
- docs/architecture/versions.mmd: stats in the first version's third group
- docs/plugin-api.md: stats named as a provider of `coordinator.extension`
- docs/setup.md: stats in the plugin list and the sample config
- package-lock.json: `@arthur/stats` as a workspace, at version 0.1.0
- packages/orchestration/docs/commands/coordinator.md: names the stats plugin's coordinator extension
- packages/stats/package.json: the new package, as `arthur plugin new` writes it, with the release version 0.1.0
- packages/stats/docs/stats.md: what `runs.jsonl` and `sessions/<session>.jsonl` hold, who writes them, the backfill, and the rules for the files
- packages/stats/src/stats.ts: the plugin: `job-ended` lines held until start, skipped by seq, delta numbers, missing lines, the one-time backfill, and its `coordinator.extension` answer
- packages/stats/src/session-extension.ts: the coordinator's OMP extension that appends one line per real end of a turn, counting nothing twice
- packages/stats/src/stats-lines.ts: reads and appends the line files (a cut line gets its break, unreadable lines are skipped) and sums usage per model
- packages/stats/test/stats.test.ts: fake-host and fake-agent tests for each behavior of S3
- test/option-tables.test.ts: checks stats' options file, a plugin with no options
- test/structure.test.ts: `stats: 200` in BUDGETS
- spec/features/AR0650-stats-s3-the-stats-plugin-keeps-one-line-per-job-run-and-per-coordinator-turn/findings.md: F1 (fixed in 2668c044), F2 and F3 (open)

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1557/1628 passed.

## Left open

- Deferred (client summary): F2. arthur.mmd's status line does not count core entry 108
- Deferred (client summary): F3. `arthur plugin new` writes a package without the release version
- Deferred (client summary): F4. F3 is still open: `arthur plugin new` writes no `version`, so the next new package will fail main's one-release test until that command is fixed

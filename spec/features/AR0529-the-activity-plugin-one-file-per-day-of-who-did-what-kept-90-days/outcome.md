# AR0529 - Outcome

- Merged: 2026-11-07, `a9e86bfb`
- Branch: arthur/2026-11-06-worker-d652f2fb
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $11.56, reviews $2.25; review rounds 3

## What went in

- packages/activity/package.json: the `@arthur/activity` package at version 0.1.0, exporting the plugin and its options file.
- packages/activity/src/activity.ts: the plugin and its options, `keepDays` 0 to 36500 (default 90) and `textChars` from 0 (default 300); holds events until `start`, then writes them, skipping a replay and filling a gap once, and removes old days.
- packages/activity/src/activity-line.ts: turns each logged event into a day-file line: actor, `on`, what, fields, and the text cut with media and forwards masked.
- packages/activity/src/day-files.ts: the day files: last number written, a whole-line append after a cut line, removal of days older than `keepDays`.
- packages/activity/test/activity.test.ts: plugin tests: options and their limits, no write without `start`, the day boundary in `core.timeZone`, held order, replay, gaps of one and of several events, job kind and ticket, the cut, retention including `keepDays` at its top.
- packages/activity/test/activity-line.test.ts: one row per event, owner's message parts including malformed ones, job lines, the cut at its limits.
- packages/activity/test/day-files.test.ts: last number, appending after a cut last line, retention at the `keepDays` boundary.
- packages/activity/docs/activity.md: the plugin's page: options with their ranges and refusals, line shape, event-to-text table, files and the single writer.
- arthur.config.example.ts: lists activity (and main's stats) as built, imports activity, and shows `activity({ keepDays: 90, textChars: 300 })`.
- README.md: lists activity in Features with a link to its overview; "Read more" lines merged so it stays at 120 lines.
- package-lock.json: `@arthur/activity` added as a workspace at version 0.1.0.
- test/structure.test.ts: `activity: 350` added to `BUDGETS`.
- test/option-tables.test.ts: checks activity's options file with every other package's.
- packages/develop/test/plugin-new.test.ts: expects `activity` as the budget after `acme`.
- spec/features/AR0529-the-activity-plugin-one-file-per-day-of-who-did-what-kept-90-days/findings.md: F1 (README cap) fixed in c7cc8082; F2 (diagrams and roadmap entries) and F3 (plugin-new tests pinned to a neighbour name) open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1574/1645 passed.

## Left open

- Deferred (client summary): F2. The diagrams and the roadmap do not show the activity plugin or entries 99 to 101
- Deferred (client summary): F3. plugin-new's tests pin the budget that sorts next to `acme`

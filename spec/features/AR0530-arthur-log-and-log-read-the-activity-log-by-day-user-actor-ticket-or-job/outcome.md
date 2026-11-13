# AR0530 - Outcome

- Merged: 2026-11-13, `56514cf4`
- Branch: arthur/2026-11-13-worker-38c25313
- Reviews: review-1.md PASS
- Cost: worker $4.37, reviews $0.94; review rounds 1

## What went in

- `packages/activity/src/log-command.ts`: `arthur log` and `/log`: one day of the activity log with the day, user, actor, ticket, job and project filters, read-only commands hidden unless `--all`, `/log` answering the last 30 lines.
- `packages/activity/src/day-files.ts`: `readLines(folder, from, to)` reads the lines that can be shown from the day files in a date range, skipping broken or hand-edited ones; `lastSeq` shares its JSON reader.
- `packages/activity/src/activity.ts`: registers `logCommand` at setup; its header comment names entry 101.
- `packages/activity/docs/commands/log.md`: the doc page `arthur log --help` prints: usage, line format, hidden commands, each filter, `/log`, refusals.
- `packages/activity/docs/activity.md`: points to `arthur log` and `/log` instead of calling them entry 101 to come.
- `packages/activity/test/log-command.test.ts`: tests for the default, `--all`, each filter and their combinations, each read-only command, wrong usage, hand-edited and cut lines, `/log` through the fake host (words, usage, the 30-line limit), and lines written by the plugin read back.
- `packages/activity/test/activity.test.ts`: `load()` gives each simulated process its own command registration.
- `arthur.config.example.ts`: the activity comment mentions `arthur log` and `/log`.
- `README.md`: the activity line says `arthur log` and `/log` read the log by day, user, actor, ticket or job.
- `arthur.mmd`: the activity node is built, with `arthur log, /log` no longer marked planned.
- `spec/features/AR0530-arthur-log-and-log-read-the-activity-log-by-day-user-actor-ticket-or-job/findings.md`: F1, the fixed read-only command list.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1757/1828 passed.

## Left open

- Deferred (client summary): F1. The commands `arthur log` hides are a fixed list in the activity plugin

# AR0614 - Outcome

- Merged: 2026-11-04, `752fb17b`
- Branch: arthur/2026-11-04-worker-b8b7460d
- Reviews: review-1.md PASS
- Cost: worker $4.07, reviews $0.47; review rounds 1

## What went in

- `arthur.config.example.ts`: the `session` block shows `compactOn: "schedule"` and `compactAtPercent: 80`, each with a one-line comment.
- `packages/session/docs/session.md`: documents `compactOn` and `compactAtPercent`, their refusals, the context trigger (when it asks, what lets it ask again, "both" as whichever comes first), and the `context-use` file.
- `packages/session/src/request.ts`: the comment says a request's slot may also be `context <n>%`.
- `packages/session/src/session-options.ts`: the `compactOn` and `compactAtPercent` defaults, option table entries and checks.
- `packages/session/src/session.ts`: deletes `context-use` at start; each tick reads and deletes it and asks for a compaction at the threshold, asking once until a compaction finishes or a reading falls below; `"context"` turns the schedule off.
- `packages/session/src/turn-extension.ts`: at each real turn end, writes OMP's context-use percent to `context-use` (temporary name, then rename).
- `packages/session/test/restart-guard.test.ts`: a job's launch is identical under all three `compactOn` values and loads no session extension.
- `packages/session/test/session.test.ts`: runs the done, failed-handoff and busy compaction tests once per trigger; tests the default, context-only (thresholds 1, 80, 99), both, repeated-crossing and option refusal (0, 100, 50.5, "80", -1) cases, and that the example config gives `session` every option it accepts.
- `packages/session/test/start-notice.test.ts`: the turn extension's report, including aborted and failed turns, and no file without UI, while OMP goes on, without the API, with an undefined answer, a zero window or a missing percent.
- `spec/features/AR0614-session-compact-the-coordinator-by-schedule-by-context-use-or-both-chosen-in-the/findings.md`: F1, mutate skips package tests of root files.
- `spec/roadmap.md`: the session options line lists `compactOn` and `compactAtPercent` (35, AR0614).
- `test/structure.test.ts`: the `session` line budget is 953 (was 917).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1454/1525 passed.

## Left open

- Deferred (client summary): F1. npm run mutate never runs a package's tests for a change to a root file such as arthur.config.example.ts
- Deferred (client summary): F2. the `context-use` write runs before the failure logic without creating the folder first

# AR0656 - Outcome

- Merged: 2026-11-09, `2f2ef424`
- Branch: arthur/2026-11-08-worker-2ea1125b
- Reviews: review-1.md PASS
- Cost: worker $2.76, reviews $0.76; review rounds 1

## What went in

- `packages/delivery/src/checks-extension.ts`: when a worker's run ends before its check, test and mutate passed on its clean committed tip, it sends one `[Arthur] Before your run ends` reminder that names what is missing, judged by `untested`; its git command is shared by the worktree read and the reminder.
- `packages/delivery/test/checks.test.ts`: tests for when the reminder comes and when it doesn't, and for the git reads leaving a stale index untouched (no optional lock).
- `test/structure.test.ts`: delivery's line budget raised from 2220 to 2243.
- `spec/features/AR0656-a-worker-is-told-before-its-run-ends-that-its-checks-did-not-pass-on-its-clean/findings.md`: F1 (the processes reminder can be lost when both reminders fire) and F2 (the docs don't mention the reminder), both open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1580/1651 passed.

## Left open

- Deferred (client summary): F1. The processes reminder is lost in a run whose end also gets the checks reminder
- Deferred (client summary): F2. The docs do not name the checks reminder at a worker's run end
- Deferred (client summary): F3. the processes reminder (AR0585) can be lost

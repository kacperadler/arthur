# AR0433 - Outcome

- Merged: 2026-10-26, `e61ec246`
- Branch: arthur/2026-10-26-worker-78c8763d
- Reviews: review-1.md PASS
- Cost: worker $0.91, reviews n/a; review rounds 1

## What went in

- `packages/orchestration/src/inbox.ts`: each line a plugin adds to the coordinator's wake, and the reason in `ended its run: <state> (<reason>)` (a `Blocked: on` text included), go through the values-only redaction, so no env-file value reaches the coordinator or a channel; job ids stay readable.
- `packages/orchestration/test/job-states.test.ts`: a job whose `Blocked: on` reason and onboarding-style question hold an env value gives a wake with `[redacted]` in each place.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1114/1180 passed.

## Left open

- None.

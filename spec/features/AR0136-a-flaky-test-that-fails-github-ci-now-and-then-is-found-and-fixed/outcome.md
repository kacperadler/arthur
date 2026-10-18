# AR0136 - Outcome

- Merged: 2026-10-18, `f520142`
- Branch: h/2026-10-18-ar0136-flaky-test-6f928022
- Reviews: review-1.md PASS
- Cost: worker $8.03, reviews $0.94; review rounds 1

## What went in

- `packages/orchestration/test/inbox.test.ts`: waits for `job-ended` in the event log before reading it (F1).
- `packages/orchestration/test/context.test.ts`: compares the time against one reading of the clock (F2).
- `packages/core/test/job-control.test.ts`, `limits.test.ts`: SIGKILL and other deadlines sized for a slow runner, measured from the logged time (F3, F5).
- `packages/core/test/job-records.test.ts`: each sweep test uses its own job id (F4).
- `packages/core/test/machine.test.ts`, `packages/machines/test/machines.test.ts`, `packages/orchestration/test/coordinator.test.ts`: deadlines sized for a slow runner (F5).
- `packages/core/test/run.test.ts`: checks each process's own order in a shared event log (F7).
- No production code changed; 24 parallel loaded runs passed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 434/434 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0137 (F6).

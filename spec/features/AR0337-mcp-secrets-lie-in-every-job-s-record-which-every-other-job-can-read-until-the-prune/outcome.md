# AR0337 - Outcome

- Merged: 2026-10-25, `b77e47e9`
- Branch: arthur/2026-10-25-worker-4bc2cf0a
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $7.75, reviews n/a; review rounds 3

## What went in

- `packages/core/src/wrapper.ts`, `job-scope.ts`, `job-records.ts`: a job's `mcp/` folder is deleted before `state` at every end of a run (the wrapper's end, a launch that never starts, the sweep's `process gone`).
- `packages/core/src/job-record.ts`, `job-control.ts`, `jobs.ts`: `writeMcp` (mode 600) writes it at the spawn and again at `arthur continue`, for a local job only; a job whose kind no plugin registers gets none.
- `packages/core/src/env-refusal.ts`: the env guard refuses `.mcp.json` and suffixed names, in any case and through a glob.
- `packages/orchestration/docs/commands/coordinator.md`: says every job of the user can read the file while it exists.
- Tests: the record has no `mcp/` once a run ends and a continue writes it back; a continue on another machine writes none and sends no secret; the guard's rows.
- `test/structure.test.ts`: core's budget 6168 (AR-D29).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1128/1128 passed.

## Left open

- Findings: F1-F3, review notes, dropped (see findings.md).

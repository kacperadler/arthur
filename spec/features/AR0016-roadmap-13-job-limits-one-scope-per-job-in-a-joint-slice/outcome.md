# AR0016 - Outcome

- Merged: 2026-10-16, `3308105`
- Branch: h/2026-10-16-ar0016-one-scope-per-job-d48b552c
- Reviews: review-1.md PASS
- Cost: worker $5.66, reviews $0.99; review rounds 1

## What went in

- `packages/core/src/job-scope.ts`: each job in `arthur-job-<id>.scope` inside `arthur-jobs.slice` with `CPUQuota` and `MemoryMax` from `jobs.cpu` and `jobs.memory`; whatever the job leaves is killed before its `state`; with no user manager the job runs bare and its log says why.
- `config.ts`: memory values systemd refuses are refused at load. Tests run in their own `arthur_test_<hex>` slice.

## Checks on main

- `npm run check`: passed.
- `npm test`: 230/230 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0056 (F1).

# AR0566 - Outcome

- Merged: 2026-10-30, `425ca8aa`
- Branch: arthur/2026-10-30-worker-1f9e4a41
- Reviews: review-1.md PASS
- Cost: worker $1.63, reviews $0.29; review rounds 1

## What went in

- `packages/delivery/roles/reviewer.md`, `packages/manage/roles/auditor.md`, `packages/manage/roles/retro.md`, `packages/orchestration/roles/planner.md`, `packages/orchestration/roles/plan-reviewer.md`: each carries the worker's timeout rule word for word (one bash call, timeout 1800 s, up to 3600); none names `proc://` or a `sleep 30` loop; the Never line says to wait for a command, then write from its output.
- `packages/delivery/test/review.test.ts`, `packages/manage/test/audit.test.ts`, `packages/manage/test/retro.test.ts`, `packages/orchestration/test/plans.test.ts`: each job's real prompt holds the rule and no `proc://` or `sleep 30`.
- `packages/core/src/job-omp.yml`: unchanged; a real omp run showed the `launch` key changes nothing.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1254/1322 passed.

## Left open

- Deferred (client summary): F1. Old review files under spec/features still describe polling proc://.

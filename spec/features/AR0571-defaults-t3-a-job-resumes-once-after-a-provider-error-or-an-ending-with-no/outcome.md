# AR0571 - Outcome

- Merged: 2026-10-30, `4393690f`
- Branch: arthur/2026-10-30-worker-4caae474
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $5.63, reviews $1.30; review rounds 2

## What went in

- `packages/core/src/job-ending.ts` (new): the ladder that names how a run ended, moved out of `wrapper.ts`; it tells a transient provider error (connection error, overloaded, 5xx) from a cyber refusal or a user abort.
- `packages/core/src/wrapper.ts`: resumes a run once with `--continue`, through the budget-resume path, when it stopped on a transient provider error or a kind with verdicts ended without one; a second failure ends the run as before; a refusal or an abort is never resumed.
- `packages/core/src/job-omp.yml`: `retry.maxRetries: 20`.
- `packages/orchestration/src/plans.ts`: a plan review has the verdicts PASS and FAIL, so it is resumed like a review.
- `packages/delivery/src/delivery.ts`, `packages/delivery/roles/reviewer.md`: the review wake says a review was resumed once already; the reviewer's clause on ending without a verdict is gone.
- `packages/core/docs/commands/spawn.md`, `packages/delivery/docs/commands/review.md`, `packages/orchestration/docs/commands/plan.md`, `packages/models/docs/models.md`: say the above.
- `packages/core/test/wrapper.test.ts`, `job-control.test.ts`, `packages/delivery/test/review.test.ts`, `packages/orchestration/test/plans.test.ts`, `packages/models/test/models.test.ts`: tests of each, a second failure included.
- `test/structure.test.ts`: the core line budget 6478 to 6503 (+25, AR-D355).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1293/1361 passed.

## Left open

- Deferred (client summary): F1. omp's 20 tries of an Anthropic overload take about 19 minutes, not about 2
- Deferred (client summary): F2. plan-file.ts files a plan review's verdict `none`, which no plan review that may be filed has any more
- Deferred (client summary): F3. Deleting record.clearStop() before the resume passes every wrapper test.
- Deferred (client summary): F4. The 5xx pattern matches any 3-digit number from 500 to 599 in an error.
- Deferred (client summary): F5. A run resumed at its budget can also get this resume, so up to three runs, untested together.
- Deferred (client summary): F6. The review wake says the review was resumed for a missing verdict even when the one resume was for a provider error.

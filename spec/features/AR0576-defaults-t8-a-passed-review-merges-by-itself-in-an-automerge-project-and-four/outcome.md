# AR0576 - Outcome

- Merged: 2026-10-30, `c2bb5da7`
- Branch: arthur/2026-10-30-worker-01f1b438
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $15.57, reviews $2.45; review rounds 2

## What went in

- `packages/delivery/src/pass-forward.ts`: new; in `arthur run`, runs `arthur merge --auto <job>` as a child after a PASS, a `no-review` event or CI passed, once per cause, and wakes the coordinator once with its output.
- `packages/delivery/src/delivery.ts`: wires the merge on its own (start, PASS, `delivery.ciEnded`); in an autoMerge project the PASS wake says delivery merges and files; the header says 4 FAILs.
- `packages/delivery/src/review-records.ts`: `LIMIT` is 4; `noReview()` reads `arthur review-needed`'s answer for a tip.
- `packages/delivery/src/auto-merge.ts`: `--auto` takes a `no review` for the tip as its PASS only while no review of the tip exists; a review with no verdict yet refuses, naming it.
- `packages/delivery/src/ci-wait.ts`: CI passed on a waiting branch runs the merge on its own, once per run attempt; with autoMerge turned off since, says the merge waits for the owner.
- `packages/delivery/src/review-needed.ts`: on `no review`, emits `no-review` and, with autoMerge on, says `arthur run` merges it.
- `packages/delivery/src/merge-command.ts`: `passGap` uses the shared `noReview()`.
- `packages/delivery/src/hand-back.ts`: comments name the limit as the fourth FAIL.
- `packages/delivery/src/delivery-options.ts`: summary says 4 FAILs and the merge after a no review.
- `packages/delivery/docs/commands/merge.md`: `--auto` and `no review` (only while no review of the tip exists); "On its own" section; CI-wait and "What the coordinator does" text.
- `packages/delivery/docs/commands/review.md`: limit of 4 FAILs (round 5); the PASS merges on its own with autoMerge; hand-back step 4.
- `packages/delivery/docs/commands/review-needed.md`: the `no-review` event, the autoMerge line, and CI as the check for an auto-merged no review.
- `packages/delivery/docs/delivery.md`: 4 FAILs, the merge on its own, and the `forwarded` file pruned with the job.
- `packages/delivery/roles/coordinator/review-limit.md`: procedure for a branch with 4 FAILs (fifth round, `--round 5`).
- `packages/delivery/evals/review-pass/scenario.json`: the coordinator files, prunes and merges nothing after a PASS with autoMerge on.
- `packages/delivery/evals/review-pass-hook/scenario.json`: the turn is delivery's wake with the held-path refusal; no merge again, the owner is told.
- `packages/delivery/evals/review-fail-continue/scenario.json`: the owner asks for a fifth round; the Decisions check expects it.
- `packages/delivery/evals/review-fail-continue/fixture/spec/features/SH0004-show-the-cart-s-total-with-tax/review-2.md`: a second FAIL (no test of several items).
- `packages/delivery/evals/review-fail-continue/fixture/spec/features/SH0004-show-the-cart-s-total-with-tax/review-3.md`: a third FAIL (the test rounds as the code does).
- `packages/delivery/evals/review-fail-continue/fixture/spec/features/SH0004-show-the-cart-s-total-with-tax/review-4.md`: the former review 2 (half-up rounding), now the fourth FAIL.
- `packages/delivery/test/review.test.ts`: limit rows for rounds 2–4 and the fifth review refused; merge on its own after a PASS, each CI attempt and no review, with the guards.
- `packages/delivery/test/auto-merge.test.ts`: `--auto` with `no review`, refused beside a running, verdictless or FAIL review of the tip and for a `review:` answer; the CI-passed wake with autoMerge off or on.
- `packages/develop/test/scenarios.test.ts`: right and wrong turns for the three changed evals.
- `packages/orchestration/roles/coordinator.md`: fourth FAIL; acts on delivery's own `--auto` wake, rerunning it only where its result says so.
- `packages/orchestration/roles/coordinator/morning-report.md`: merges without the owner include delivery's own.
- `packages/orchestration/docs/commands/decision.md`: `review` decisions come after the fourth FAIL.
- `packages/orchestration/test/context.test.ts`: the role rule for delivery's merge on its own and the rerun case.
- `test/ci-wait-wake.test.ts`: runs in a folder whose config holds a fake `merge`; one wake for the PASS and one for the run's end.
- `test/structure.test.ts`: delivery budget 1774 → 1834.
- `arthur.config.example.ts`: comments say 4 FAILs and autoMerge after a PASS or a no review.
- `spec/roadmap.md`: entries 52 and 55 and row O10 say 4 FAILs (2 before AR0576).
- `spec/features/AR0576-defaults-t8-a-passed-review-merges-by-itself-in-an-automerge-project-and-four/findings.md`: F1 (a restart kills a running merge), F2 (`pass-forward.ts` not on the always-review list).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1320/1388 passed.

## Left open

- Deferred (client summary): F1. A restart of arthur run kills a merge it started on its own
- Deferred (client summary): F2. pass-forward.ts is not on the always-review list
- Deferred (client summary): F3. Still open from review-1, and the worker says so

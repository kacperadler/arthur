# AR0580 - Outcome

- Merged: 2026-10-31, `1384c34b`
- Branch: arthur/2026-10-31-worker-f364e259
- Reviews: review-1.md PASS
- Cost: worker $5.57, reviews $0.46; review rounds 1

## What went in

- packages/delivery/src/review-command.ts: `tipChecks()` and `untested()`; `reviewTask` refuses a tip whose `check`/`test` did not pass or with no `mutate` record on its clean tree; `branchOf` also returns its `git`.
- packages/delivery/src/review-needed.ts: decides from `tipChecks()`, ignoring `mutate`, as before.
- packages/delivery/src/hand-back.ts: before the next review, a tip without its checks continues the worker once per round with a fixed instruction (`missed` in the record); a second miss stops the hand-back and tells the coordinator.
- packages/delivery/docs/commands/review-needed.md: new section "Before a review" with the gate, its refusal text and its exemptions.
- packages/delivery/docs/commands/review.md: the gate's refusal under Refused, and the once-per-round continue in Hand-back step 3.
- packages/delivery/test/review.test.ts: tests for refusal on each missing or failing record, the one continue, the second miss told to the coordinator, the remote exemption, and an unreadable tip told to the coordinator.
- packages/delivery/test/review-needed.test.ts: the fixture declares `mutate`, so `no review` is shown to ignore it.
- packages/delivery/test/merge.test.ts: the `review` helper records passing checks for the tip first.
- packages/delivery/test/auto-merge.test.ts: the `review` helper records passing checks for the tip first.
- test/ci-wait-wake.test.ts: records passing checks for the tip before `arthur review`.
- test/structure.test.ts: delivery budget 1897 → 1917.
- spec/features/AR0580-defaults-t12-a-review-starts-only-on-a-tip-whose-check-test-and-mutate-passed/findings.md: F1 (remote jobs not gated) and F2 (wording of the coordinator message after a second miss).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1383/1452 passed.

## Left open

- Deferred (client summary): F1. A worker on another machine passes the review gate unchecked
- Deferred (client summary): F2. The hand-back's stop after a second checks miss tells the coordinator to hand back findings
- Deferred (client summary): F3. jobs on another machine skip the gate (F1)

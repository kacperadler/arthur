# AR0555 - Review 4

- Job: 2026-10-29-review-de48d151
- Branch: arthur/2026-10-29-worker-b17e611d
- Commit reviewed: ea33d35cdd02e046bef6b802b3dfdd53a3a8a65b
- Verdict: PASS

## Final message

Both review-3 findings are fixed and every check passes. The new deferred prune of a dropped ticket's ended job, using `setImmediate`, works whichever plugin loads first. One non-blocking edge is left: a blocked review of a dropped ticket gets a wake that says delivery will prune it, but it is kept.

## Findings

None that block the merge.

## Review 3's findings

1. **Wake for a dropped ticket's review: fixed.** `packages/delivery/src/delivery.ts:102-104` now checks whether the ticket is `dropped` before building the usual verdict wake. If it is, the wake says only that the review is not filed, nothing is handed back, and delivery prunes it. The check does not look at the verdict, so PASS and FAIL get the same text. `review.test.ts` asserts the exact wake. Mutation `if (false)` in place of the check: caught, 1 fail.
2. **Merge ending hand-backs: now tested.** The new `merge.test.ts` test sets up two hand-back files in the shape `hand-back.ts` writes: `{worker, review, findings, step}`, with steps `continue` and `continued`. Mutations on `ticket-prune.ts:15`:
   - Review 3's mutation, `if (drop) endHandBack(...)`: caught ("no hand-back of the merged ticket is left").
   - Also ending only the hand-backs of jobs not in a run (`!busy.includes(id)`): caught.

## The deferred prune (`delivery.ts:79-82`)
- The core delivers an event to its handlers synchronously, in one loop (`packages/core/src/events.ts:47-48`). Orchestration builds its wake synchronously in its own `job-ended` handler (`inbox.ts:73`, `jobs.result` at `:132`).
- So a prune queued with `setImmediate` always runs after every handler of that event, whatever the plugin order. The claim holds.
- Mutation, prune called directly instead of through `setImmediate`: caught by the review test, which checks the record and `jobs.result` right after the end.
- Mutation, prune removed: caught, 2 fails (`merge.test.ts` and `review.test.ts`).
- The test waits for the state it asserts (`until(... state(id) === "")`), not for a fixed time.

## Notes (not blocking)
- **A blocked review of a dropped ticket gets a misleading wake.** If such a review ends `blocked`, it still gets the new wake ("delivery prunes it … Nothing to do"). But the core prune keeps a job that is not ended (`job-records.ts:140`, `kept: it is …, not ended`), so the job stays and the coordinator is told nothing is left to do. This only happens in that narrow case, and keeping blocked jobs on a drop was already accepted and tested in earlier rounds.
- **Line budgets match the recorded decisions.** `delivery/src` has 1734 lines (AR-D342) and `github/src` 951 (AR-D335). `delivery.ts` is 196 lines.
- **Removed hand-back line.** I did not mutate this one separately. The prune ends the hand-backs (`ticket-prune.ts:15`), and the mutations above show that line is covered.

## Checks run
- **`npm ci` and `npm run check`:** `npm ci` ran, its output discarded; `npm run check` (tsc) printed no error.
- **`npm test`:** 1309 tests, 1247 pass, 0 fail, 62 skipped, matching the worker's numbers. No `limits.test.ts` failure, so I did not run that file alone.
- **Mutations:** five, all caught as listed above. Each was restored with `git checkout --`, and `git status --porcelain` was empty afterwards.
- I ran no branch sweep and no delete against origin.

PASS
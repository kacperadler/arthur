# AR0308 - Outcome

- Merged: 2026-10-23, `d977720`
- Branch: h/2026-10-23-ar0308-continue-after-ch-f18c2f31
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.34, reviews $0.77; review rounds 2

## What went in

- `packages/delivery/docs/commands/merge.md`: on `check failed on main` the coordinator names the failed check's command, runs `arthur continue <job> '<what failed>'` without asking, and starts a new review when it ends; a CI failure in the branch's own code is handled the same way, a transient one rerun once.
- `packages/delivery/evals/check-failed/scenario.json`: the scenario requires the continue naming the failed test and the reply naming `npm test`; `packages/develop/test/scenarios.test.ts` shows the wrong turn breaking every expectation.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1048/1048 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/39947933579

## Left open

- Tickets from findings: AR0312 (F1), AR0313 (F2), AR0314 (F3).

# AR0287 - Outcome

- Merged: 2026-10-22, `fc89048`
- Branch: h/2026-10-22-ar0287-490bd629
- Reviews: review-1.md PASS
- Cost: worker $7.47, reviews $0.94; review rounds 1

## What went in

- `packages/orchestration/src/inbox.ts`: the wake passes `coordinator.wake` the job's whole final message (the scenario's `result` in an eval).
- `packages/projects/src/onboarding.ts`: reads the questions from that message; saves its per-run count only for a job in this home, so an eval writes nothing.
- `packages/delivery/src/delivery.ts`: a review with no record here (an eval's) is worded from `records.delivery` `{ ticket, branch, commit, autoMerge? }`, its verdict from the final message; a wrong shape fails the wake, named.
- `packages/develop/src/eval-scenario.ts`: `turn.ended` takes `records?`; the job belongs to the main project unless the scenario names one.
- Scenarios `review-pass`, `review-pass-hook`, `review-fail-handed-back`, `onboarding-questions`: name their records, `needs` removed. A second FAIL cannot be replayed yet (`packages/delivery/docs/commands/review.md`).
- Docs: `coordinator.md`, `eval.md`, `review.md`, `init.md`, `docs/plugin-api.md`. Budgets delivery 1285, develop 669, orchestration 2278.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1029/1029 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

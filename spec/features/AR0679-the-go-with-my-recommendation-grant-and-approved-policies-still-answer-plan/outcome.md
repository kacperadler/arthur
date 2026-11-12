# AR0679 - Outcome

- Merged: 2026-11-11, `b76c2640`
- Branch: arthur/2026-11-11-worker-72edd925
- Reviews: review-1.md PASS
- Cost: worker $1.64, reviews $0.49; review rounds 1

## What went in

- packages/orchestration/src/silent.ts: the grant never answers a `plan` question; its wording names plan questions first among those it never answers.
- packages/orchestration/src/decision-classes.ts: `byPolicy` matches no class for a `plan` question, so none answers it and none is named.
- packages/orchestration/src/decision-writes.ts: comment on `ask` says neither a class nor the grant answers a plan question.
- packages/orchestration/docs/commands/decision.md: the `plan` kind, the grant sentence and "Classes" say plan questions always go to the owner (AR-D603).
- packages/orchestration/docs/commands/silent.md: the grant's "never answers" list starts with plan questions.
- packages/orchestration/test/silent.test.ts: the grant's wording updated; a plan ask with `--recommend` under the grant stays open.
- packages/orchestration/test/decisions.test.ts: new test showing an approved plan class does not answer a plan question.
- spec/features/AR0679-the-go-with-my-recommendation-grant-and-approved-policies-still-answer-plan/findings.md: new; F1, a plan class can still be proposed and approved.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1626/1697 passed.

## Left open

- Deferred (client summary): F1. A class of kind plan can still be proposed and approved, though it now answers nothing

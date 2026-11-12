# AR0677 - Outcome

- Merged: 2026-11-10, `01269ca8`
- Branch: arthur/2026-11-10-worker-1fb651b4
- Reviews: review-1.md PASS
- Cost: worker $9.15, reviews $1.03; review rounds 1

## What went in

- `docs/plugin-api.md`: the `decision.owner` row says a plan or merge decision passes only when its answer picked option 1.
- `packages/core/docs/commands/ticket.md`: `status <id> planned --decision` says the plan question is asked with an approval option and answered `--picked 1` from a message naming the id; gives the new no-id hint.
- `packages/delivery/docs/commands/merge.md`: merge asks with `--option '<the approval>'` and answers `--picked 1`; the new refusal and hints.
- `packages/delivery/docs/commands/take-main.md`: the example asks with options and answers `--picked 1`; the new refusal and hint.
- `packages/delivery/evals/check-failed/scenario.json`: the turn is the owner's reply naming SH-D42.
- `packages/delivery/evals/merge/scenario.json`: the turn is the owner's reply naming SH-D41; it expects `decision answer SH-D41 … --picked 1`.
- `packages/develop/test/scenarios.test.ts`: the right turns for merge, check-failed and the restart scenarios answer with `--picked 1` and the id; the merge fail line follows.
- `packages/orchestration/docs/commands/decision.md`: plan and merge questions are asked with their approval as option 1 and answered by id; the gate's new refusal; the new ask refusal; the high-impact list and the notice format.
- `packages/orchestration/docs/commands/plan.md`: step 3 asks with `--option 'Approve the plan'` and answers `--picked 1` from a message naming the id.
- `packages/orchestration/roles/coordinator.md`: plan and merge questions are asked with the approval first, answered `--picked 1` with the id; a "no" is never `--picked 1`.
- `packages/orchestration/roles/coordinator/plan-ended.md`: steps 3–5 ask with the approval as option 1, approve with `--picked 1` from a message naming the id, and record a no with the option it picked.
- `packages/orchestration/src/decision-use.ts`: the gate passes a plan or merge decision only when its later answer picked option 1; the no-id hint names `--option` and `--picked 1`.
- `packages/orchestration/src/decision-writes.ts`: `ask` refuses a plan or merge question with no `--option`; `impact()` makes every plan and merge answer need the owner's message naming its id.
- `packages/orchestration/test/decision-use.test.ts`: the new gate test; helpers ask with options and answer `--picked 1`; new hint texts.
- `packages/orchestration/test/decisions.test.ts`: the ask refusal per kind; plan, plain merge and job merge need the id; a bare "yes" is refused; fixtures follow.
- `packages/orchestration/test/plans.test.ts`: asks with an approval option, answers `--picked 1`, and the owner's message names the id.
- `packages/projects/docs/commands/init.md`: the take-main ask has `--option 'Take it'` and the answer `--picked 1`.
- `packages/projects/roles/coordinator/onboarding-ended.md`: the merge and take-main asks have an approval option and the answers `--picked 1`.
- `packages/session/evals/after-restart-plan/scenario.json`: the turn is the owner's reply naming AR-D43.
- `packages/session/evals/unblocked-after-restart/scenario.json`: the turn is the owner's reply naming AR-D43.
- `spec/features/AR0677-a-no-to-a-plan-or-merge-question-still-approves-the-ticket-or-the-merge-and-a/findings.md`: new, with F1 (plan check reads only the decided line) and F2 (evals can't show open decisions).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1646/1717 passed.

## Left open

- Deferred (client summary): F1. A worker's plan check still reads the decided line, not the option the owner picked
- Deferred (client summary): F2. The merge evals name a decision id the turn's context never shows
- Deferred (client summary): F3. the approval is option 1 by convention only

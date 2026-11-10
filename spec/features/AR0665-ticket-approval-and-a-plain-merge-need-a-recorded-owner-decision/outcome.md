# AR0665 - Outcome

- Merged: 2026-11-10, `e8db1f4d`
- Branch: arthur/2026-11-10-worker-1ca8d870
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $19.23, reviews $3.63; review rounds 2

## What went in

- `packages/core/src/ticket-command.ts`: `status <id> planned` takes `--decision <id>` and asks `decision.owner` (`kind: "plan"`, `use: "planned <id>"`) before the move; `--decision` with another status, without a value or given twice is wrong usage; usage line updated.
- `packages/core/src/host.ts`: `LoadedPlugins.owner` calls `decision.owner` by name; new `OwnerRequest` type.
- `packages/core/src/core-commands.ts`: `Loaded` carries `owner`, passed to `ticketCommand`.
- `packages/core/src/cli.ts`: hands `owner` from the load to the core's commands.
- `packages/core/docs/commands/ticket.md`: documents `planned --decision <id>`, its refusals, the repeated move and its cost, the owner's approval rule and the new wrong-usage cases.
- `packages/core/test/cli.test.ts`: tests the `decision.owner` request, its pass and refusals, the board's refusal after a pass, no ask for other moves, the wrong-usage rows, and the refusal with no provider.
- `packages/core/test/ticket-command.test.ts`: new; `ticketCommand` with a fake board and owner: each refusal and pass of a move to planned, other moves and verbs asking nothing, every wrong-usage case.
- `packages/core/test/core-commands.test.ts`: new; `arthur ticket status … planned --decision` asks the loaded `owner`, then moves on the loaded board.
- `packages/core/test/host.test.ts`: `owner` asks the plugin that provides `decision.owner` and answers what it answers; refused with no provider.
- `packages/delivery/src/merge-command.ts`: every merge but `--auto` asks `decision.owner`: a plain merge as `arthur merge <job>`, each flag as itself; `--auto --decision` is wrong usage; new usage line.
- `packages/delivery/src/auto-merge.ts`: the autoMerge-off and held-path refusals name `arthur merge <job> --decision <the owner's decision id>`.
- `packages/delivery/src/ci-wait.ts`: the autoMerge-off wake after CI passed names `--decision`.
- `packages/delivery/src/pass-forward.ts`: the autoMerge-off wake after a dead merge's rollback names `--decision`.
- `packages/delivery/docs/commands/merge.md`: usage, the owner's decision for every merge but `--auto`, its refusal, wrong usage, what the coordinator does on that refusal, and every owner-merge line naming `--decision`.
- `packages/delivery/evals/review-pass-hook/scenario.json`: the held-path refusal names `--decision`.
- `packages/delivery/test/merge.test.ts`: plain merges pass `--decision`; new test for the plain-merge refusal and pass; usage and `--no-ci` request rows updated.
- `packages/delivery/test/merge-command.test.ts`: new; fast tests of `arthur merge`'s wrong usage and of which decision requests a merge makes after a PASS, `--auto` asking none.
- `packages/delivery/test/auto-merge.test.ts`: a fake `decision.owner`; `--auto` asks none; a plain merge passes `--decision`; refusals and wakes name `--decision`.
- `packages/delivery/test/review.test.ts`: the CI-passed rerun's wake names `--decision`; new test of a dead merge in a project whose autoMerge is off since: rolled back, not run again, the wake names `--decision`.
- `packages/github/src/github-pr.ts`: `pr merge`'s refusal names `arthur merge <job> --decision <id>`.
- `packages/github/docs/commands/github-pr.md`: the refusal text as the code gives it.
- `packages/github/test/github-pr.test.ts`: pins the new refusal text.
- `packages/orchestration/src/decision-use.ts`: a plain merge's `what` is not checked against `--what`; the no-id hint omits `--what` for it; a `planned <ticket>` use passes again for the same move.
- `packages/orchestration/src/plans.ts`: a plan approval line counts only when its decision id is a proved, owner-answered `plan` decision of the ticket approving that commit.
- `packages/orchestration/docs/commands/decision.md`: the `plan` and `merge` kinds, the grant's exclusions (a plain merge too) and "What only the owner's decision lets through" cover the plain merge and the move to planned.
- `packages/orchestration/docs/commands/silent.md`: the merge questions the grant never answers include a plain merge.
- `packages/orchestration/docs/commands/plan.md`: step 3 sets planned with `--decision`; new refusal for an approval line without a proved decision.
- `packages/orchestration/roles/coordinator.md`: ticket approval is asked as `--kind plan` and set with `--decision`; a merge is recorded first, then `arthur merge <job> --decision <id>`.
- `packages/orchestration/roles/coordinator/plan-ended.md`: step 4 sets the ticket planned with `--decision <decision id>`.
- `packages/orchestration/test/decision-use.test.ts`: tests for a plain merge's decision, the planned use, its kind and ticket refusals, and the repeated move.
- `packages/orchestration/test/plans.test.ts`: approvals come from real ask and answer; refuses a line by hand, an unknown id, another kind, another ticket, another commit, no message, and a later answer; accepts a cut line beside a line that is no approval.
- `packages/delivery/evals/merge/scenario.json`: stubs the decision ask and answer; expects the ask and `arthur merge … --decision SH-D41`.
- `packages/delivery/evals/check-failed/scenario.json`: stubs the decision ask and answer; expects `arthur merge … --decision SH-D42`.
- `packages/session/evals/unblocked-after-restart/scenario.json`: stubs the decision ask and answer; expects `arthur merge … --decision AR-D43`.
- `packages/session/evals/after-restart-plan/scenario.json`: stubs the decision ask and answer; expects `arthur merge … --decision AR-D43`.
- `packages/develop/test/scenarios.test.ts`: the right turns of these evals record the decision before merging; the wrong turns' expected failures are updated.
- `docs/plugin-api.md`: the `decision.owner` row names `arthur merge` and the core's `arthur ticket status <id> planned` as callers.
- `test/structure.test.ts`: core budget 7445 → 7463, orchestration 2829 → 2846 (AR-D538).
- `spec/features/AR0665-ticket-approval-and-a-plain-merge-need-a-recorded-owner-decision/findings.md`: new; F1 fixed in 1dcfa484, F2 to F4 open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1617/1688 passed.

## Left open

- Deferred (client summary): F2. A plan or ticket approved by the grant or a class can no longer be set planned
- Deferred (client summary): F3. `npm run mutate` reaches 10 of 25 mutants in its deadline on a diff that touches core and delivery
- Deferred (client summary): F4. Any answer to a plan question sets the ticket planned, a no included
- Deferred (client summary): F5. the new gates rest on weaker proof than merge flags

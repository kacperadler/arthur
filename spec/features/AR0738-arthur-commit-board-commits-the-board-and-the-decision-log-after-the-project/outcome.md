# AR0738 - Outcome

- Merged: 2026-11-25, `d8811c25`
- Branch: arthur/2026-11-25-worker-c951ebce
- Reviews: review-2.md PASS
- Cost: worker $1.21, reviews $1.26; review rounds 1

## What went in

- README.md: lists `commit-board` among the commands (from the earlier job).
- docs/plugin-api.md: lists the `delivery.commit` service: delivery provides it, projects (`arthur init`) asks it (from the earlier job).
- docs/setup.md: says `arthur commit-board` and `arthur init`'s commit run the project's commit-msg script, and that `arthur init` commits what it wrote (from the earlier job).
- packages/delivery/docs/commands/commit-board.md: new doc page for `arthur commit-board` and `delivery.commit` (from the earlier job).
- packages/delivery/docs/commands/merge.md: a refused `spec:` commit is committed with `arthur commit-board` (from the earlier job).
- packages/delivery/docs/commands/review.md: the coordinator commits a filed review with `arthur commit-board` (from the earlier job).
- packages/delivery/docs/delivery.md: the plugin overview names `arthur commit-board` (from the earlier job).
- packages/delivery/evals/condition-before-review/scenario.json: expects an `arthur commit-board` call instead of main moving (from the earlier job).
- packages/delivery/evals/merge/scenario.json: the merge output tells the coordinator to commit with `arthur commit-board 'spec: <id> merged'` (from the earlier job).
- packages/delivery/roles/coordinator/after-merge.md: a refused `spec:` commit is committed with `arthur commit-board` (from the earlier job).
- packages/delivery/roles/coordinator/review-failed-limit.md: a filed FAIL is committed with `arthur commit-board` (from the earlier job).
- packages/delivery/roles/coordinator/review-failed.md: a filed FAIL is committed with `arthur commit-board` (from the earlier job).
- packages/delivery/roles/coordinator/review-limit.md: filed reviews are committed with `arthur commit-board` (from the earlier job).
- packages/delivery/src/commit-board.ts: `arthur commit-board` and `commitPaths`; a glob pathspec's characters other than `*` and `**/` are literal, under a strict (`u`) regular expression.
- packages/delivery/src/delivery.ts: registers `commit-board` and provides `delivery.commit` (from the earlier job).
- packages/delivery/src/merge-outcome.ts: exports `vetted` for `commit-board` to reuse (from the earlier job).
- packages/delivery/src/review-wake.ts: the wake message names `arthur commit-board` (from the earlier job).
- packages/delivery/test/commit-board.test.ts: tests for `commit-board` and `delivery.commit`, including a glob whose `(`, `)`, `+`, `^`, `$`, `{`, `}`, `?`, `|`, `[` and `]` are literal.
- packages/delivery/test/review.test.ts: the wake messages name `arthur commit-board` (from the earlier job).
- packages/develop/test/scenarios.test.ts: the scenario commit step is `arthur commit-board` (from the earlier job).
- packages/manage/evals/audit-autopilot/scenario.json: expects an `arthur commit-board` call (from the earlier job).
- packages/manage/evals/retro/scenario.json: expects an `arthur commit-board` call (from the earlier job).
- packages/manage/roles/coordinator/audit-ended.md: commits the audit with `arthur commit-board` (from the earlier job).
- packages/manage/roles/coordinator/pyramid-ended.md: commits the pyramid report with `arthur commit-board` (from the earlier job).
- packages/manage/roles/coordinator/retro-ended.md: commits the retro with `arthur commit-board` (from the earlier job).
- packages/orchestration/docs/commands/decision.md: `spec/decisions.jsonl` is committed by `arthur commit-board` (from the earlier job).
- packages/orchestration/docs/commands/plan.md: a filed plan is committed with `arthur commit-board` (from the earlier job).
- packages/orchestration/roles/coordinator.md: names `arthur commit-board` and what it commits (from the earlier job).
- packages/orchestration/roles/coordinator/plan-ended.md: commits the plan with `arthur commit-board` (from the earlier job).
- packages/orchestration/roles/project.md: names `arthur commit-board` for the project agent (from the earlier job).
- packages/projects/docs/commands/init.md: `arthur init` commits the files it created through `delivery.commit` (from the earlier job).
- packages/projects/src/init.ts: asks `delivery.commit` to commit the files it created, and prints its line or its refusal (from the earlier job).
- packages/projects/src/projects.ts: passes the host to `init` (from the earlier job).
- packages/projects/test/init.test.ts: tests `init`'s commit through a faked `delivery.commit` (from the earlier job).
- packages/session/evals/after-restart-agent/scenario.json: the merge output names `arthur commit-board` (from the earlier job).
- packages/session/evals/after-restart-plan/scenario.json: the merge output names `arthur commit-board` (from the earlier job).
- packages/session/evals/unblocked-after-restart/scenario.json: the merge output names `arthur commit-board` (from the earlier job).
- spec/features/AR0738-arthur-commit-board-commits-the-board-and-the-decision-log-after-the-project/findings.md: the ticket's findings (from the earlier job).
- spec/roadmap.md: names `arthur commit-board` and `init`'s commit through `delivery.commit` (from the earlier job).
- test/init-commit.test.ts: root test of `arthur init` with the real delivery plugin's `delivery.commit` (from the earlier job).
- test/structure.test.ts: line budgets raised, delivery from 2370 to 2473 and projects from 595 to 600 (from the earlier job).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1877/1948 passed.

## Left open

- Deferred (client summary): F1. arthur commit-board pushes nothing, and the sandboxed coordinator of AR0667 T5 cannot push
- Deferred (client summary): F2. Board files that are no .md under spec/features, and the owner's spec files, have no command that commits them
- Deferred (client summary): F3. A failed check of arthur merge resets main under a commit made by plain git during its checks
- Deferred (client summary): F4. The eval baseline was recorded before the roles named arthur commit-board
- Deferred (client summary): F5. vetted throws without naming package.json or the command when the check cannot be read or started
- Deferred (client summary): F6. The commit-msg check arthur commit-board runs is the checkout's, not HEAD's
- Deferred (client summary): F7. A hard link among the board files is committed with the content of the file it shares

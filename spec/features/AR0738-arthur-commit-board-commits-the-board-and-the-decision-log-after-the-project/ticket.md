# AR0738 - arthur commit-board commits the board and the decision log after the project commit-msg check (AR0667 T2)

```json
{
  "id": "AR0738",
  "title": "arthur commit-board commits the board and the decision log after the project commit-msg check (AR0667 T2)",
  "date": "2026-11-24"
}
```

## Description

Delivery gets `arthur commit-board '<subject>' [--project <name>]`, which commits only the board's files after `checkConfig` and the project's `commit-msg` script. The coordinator and the project agents then no longer run `git commit` for the board and cannot skip the check. `arthur init` commits the files it created.

## Goal

No board or decision-log commit reaches a project's main without its `commit-msg` check. This is step T2 of AR0667's approved plan (`spec/features/AR0667-plan-the-coordinator-in-a-sandbox-with-arthur-run-as-a-broker-for-its-writing/plan.md`, lines 41 to 48, plan approved as AR-D594), and proposal 1 of `spec/quality/2026-11-24.md`. AR0734 (F1 of its findings) asked for this ticket, since a worker may not file one.

- Kind: security

## Done means

The plan's "How to test", T2 (plan.md line 146):
- Only board paths are committed, and other staged or changed files stay as they were; a test holds it.
- A symlink, a `checkConfig` refusal and a refusing `commit-msg` each stop the commit; a test holds each.
- `arthur init`'s files are committed; a test holds it.
- The roles and procedures that say "commit" the board name the command, `packages/orchestration/roles/project.md` included.
- The board paths cover what the coordinator commits today besides the plan's three: `spec/schedule.json`, `spec/quality/<date>.md`, `spec/retro/<date>.md` and `.html`, or the ticket says why one stays out.
- `npm run check && npm test && npm run mutate` pass.

## Scope

In:
- The plan's "Files", T2 (plan.md line 103): `packages/delivery/src/commit-board.ts` (new), `packages/delivery/src/merge-outcome.ts` (export `vetted`), `packages/delivery/src/delivery.ts`, `packages/delivery/docs/commands/commit-board.md` (new), `packages/projects/src/init.ts`, `packages/projects/docs/commands/init.md`, `packages/orchestration/roles/coordinator.md`, `packages/orchestration/roles/coordinator/plan-ended.md`, `packages/orchestration/docs/commands/plan.md` and `decision.md`, budgets, tests in delivery and projects.
- `packages/orchestration/roles/project.md`, written after the plan.

Out:
- T1 and T3 to T6 of AR0667.
- Rewriting Git history.

## Decisions
- 2026-11-24: AR0738 approved: arthur commit-board, AR0667 T2, at a budget of $10; the owner: "AR-D725 1" (AR-D725)
- 2026-11-24: The owner approved AR0738's budget of $20; it commits its written work, runs the checks and goes to review; the owner: "AR-D726 1" (AR-D726)
- 2026-11-24: The owner approved AR0738's budget of $28; it runs the checks on its tip, fixes what fails and goes to review; the owner: "AR-D727 1" (AR-D727)
- 2026-11-24: The owner approved AR0738's budget of $12 for a fresh worker that takes the old branch, finishes, runs the checks and goes to review; the owner: "AR-D730 1, AR-D729 1, another project's decision 1, another project's decision 1" (AR-D729)
- 2026-11-25: Merge AR0738 (arthur commit-board) into main; the owner: "AR-D734 yes" (AR-D734)


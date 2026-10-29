# AR0484 - A board entry's `path` is never checked, so a filing writes `plan.md` or `review-N.md` outside the project

```json
{
  "id": "AR0484",
  "title": "A board entry's `path` is never checked, so a filing writes `plan.md` or `review-N.md` outside the project",
  "date": "2026-10-27"
}
```

## Description

F3 of AR0403 (spec/features/AR0403-security-review-of-our-own-code-part-2-injection-into-shell-git-ssh-and-tmux-and-prompt-injection/findings.md).

- Kind: security
- Severity: medium
- Found by: 2026-10-27-worker-999ff80a (worker), 2026-10-27
- Where: `packages/core/src/board-file.ts:76` (any non-empty string), `packages/core/src/ticket-file.ts:23`, `:38`, `packages/orchestration/src/plan-file.ts:14-17`, `:24-37`, `packages/delivery/src/review-file.ts:18-28`; reads through it: `packages/orchestration/src/board-commands.ts:71-74`, `packages/orchestration/src/autopilot.ts:41`, `packages/manage/src/stats.ts:44-45`, `packages/delivery/src/changelog.ts:27`
- Input: `spec/build.json` of a project's main checkout: a merged branch that changes it (it is not on delivery's always-review list, `packages/delivery/src/delivery-options.ts:17`, so a small change can get `no review`), a client's own repository, the coordinator.
- Why the check misses it: `entryProblem` checks only that `path` is a string; every filing joins `dirname(path)` to the project's folder, so `..` leaves it. Probe in a temporary folder: an entry with `path: "spec/features/../../../outside/ticket.md"` passed `readBoard`, and `filePlan` returned `../outside/plan.md` and wrote `outside/plan.md`, nothing in the project.
- What: `arthur ticket file`, run outside any sandbox, writes a plan job's or a review job's final message as `plan.md`, `plan-review-N.md` or `review-N.md` into any folder Arthur's user can write (a folder whose `.md` files an agent loads as rules is one), and `arthur task` prints any `ticket.md` or `plan.md` the path names.
- Suggestion: `entryProblem` refuses a `path` that is not `spec/features/<its own id>-<slug>/ticket.md` with a slug of `[a-z0-9-]` (the shape `delivery.ts:27` already reads); add `spec/build.json` to the always-review list.

## Goal

Close F3 of AR0403 (severity medium): `arthur ticket file`, run outside any sandbox, writes a plan job's or a review job's final message as `plan.md`, `plan-review-N.md` or `review-N.md` into any folder Arthur's user can write (a folder whose `.md` files an agent loads as rules is one), and `arthur task` prints any `ticket.md` or `plan.md` the path names.

- Kind: security

## Done means

- The fix the security review suggests, or one that closes the same gap with less code:
  > `entryProblem` refuses a `path` that is not `spec/features/<its own id>-<slug>/ticket.md` with a slug of `[a-z0-9-]` (the shape `delivery.ts:27` already reads); add `spec/build.json` to the always-review list.
- A test that fails before the change and passes after it, for the case the Description reproduces.
- The project's checks pass.

## Scope

In:
- `packages/core/src/board-file.ts`
- `packages/core/src/ticket-file.ts`
- `packages/delivery/src/changelog.ts`
- `packages/delivery/src/review-file.ts`
- `packages/manage/src/stats.ts`
- `packages/orchestration/src/autopilot.ts`
- `packages/orchestration/src/board-commands.ts`
- `packages/orchestration/src/plan-file.ts`

Out:
- Other findings of AR0403: their own tickets (AR0482 to AR0489).

## Decisions

- 2026-10-27: Source: F3 of AR0403
- 2026-10-29: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)

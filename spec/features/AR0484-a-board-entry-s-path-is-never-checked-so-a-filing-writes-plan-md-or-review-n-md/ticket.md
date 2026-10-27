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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F3 of AR0403

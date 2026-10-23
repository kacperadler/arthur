# AR0351 - A docs-only branch that rewrites the prompt files every later job reads gets `no review`

```json
{
  "id": "AR0351",
  "title": "A docs-only branch that rewrites the prompt files every later job reads gets `no review`",
  "date": "2026-10-23"
}
```

## Description

a worker's branch that changes only Markdown, among it `.agents/arthur/roles/worker.md` (the override every worker of the project reads, `worker.md:9`), `.agents/arthur/criteria/styleguide.md`, `criteria/autopilot.md`, `spec/vision.md` (the coordinator's context, `context.ts:32-36`), or in Arthur's own repository `packages/orchestration/roles/coordinator.md` and every procedure under `packages/*/roles/coordinator/`, is answered `no review: N files, all docs (*.md)` (`review-needed.test.ts:111`, row 98), its ticket moves to done, and the owner is asked to merge on that one line; a ticket born of a finding (a job's text) whose Scope names such a file passes autopilot's list check. After the merge the text binds every job and the coordinator, who read it with no rule that it may not be the owner's (F2).

## Goal

A branch that changes the prompt files later jobs read (roles, criteria, the vision) is always reviewed, even when it changes docs only; tested.

- Kind: risk

Evidence:
- `packages/delivery/src/review-needed.ts:65` (`no review: N files, all docs (*.md)`, whatever the size), `packages/delivery/src/delivery-options.ts:16` (the always-review list holds `**/roles/reviewer.md` and `**/criteria/review.md` only), `packages/delivery/src/merge-command.ts:140` (the merge takes that answer as the PASS), `packages/orchestration/src/autopilot.ts:67` (a ticket's Scope is held only by that list)
- Found by: 2026-10-23-ar0322-security-check-8f253fd2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: add to the default always-review list the files the roles read: `.agents/**` (so every override and criteria file, see F4), `spec/vision.md`, `**/roles/**` and `**/criteria/**` (Arthur's own and a project's `prompts` folders, which `promptFiles` of `roles.ts` knows), and let the docs-only rule (`review-needed.ts:65`) come after the list, as it does. Tests in `review-needed.test.ts`: a branch that changes only `.agents/arthur/roles/worker.md`, one that changes only `spec/vision.md`, each answered `review: <path> is on the always-review list`; `delivery.alwaysReview` answering those paths; `autopilot.test.ts`: a ticket whose Scope names one is refused. Out: reviewing every `.md` (a README stays docs).
- `npm test` and `npm run check` pass.

## Scope

In:
- add to the default always-review list the files the roles read: `.agents/**` (so every override and criteria file, see F4), `spec/vision.md`, `**/roles/**` and `**/criteria/**` (Arthur's own and a project's `prompts` folders, which `promptFiles` of `roles.ts` knows), and let the docs-only rule (`review-needed.ts:65`) come after the list, as it does. Tests in `review-needed.test.ts`: a branch that changes only `.agents/arthur/roles/worker.md`, one that changes only `spec/vision.md`, each answered `review: <path> is on the always-review list`; `delivery.alwaysReview` answering those paths; `autopilot.test.ts`: a ticket whose Scope names one is refused. Out: reviewing every `.md` (a README stays docs).

## Decisions

- 2026-10-23: Source: F3 of AR0322
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.

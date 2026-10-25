# AR0431 - A review's project is not checked against its worker's

```json
{
  "id": "AR0431",
  "title": "A review's project is not checked against its worker's",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0357 (spec/features/AR0357-the-review-kind-takes-any-task-with-the-three-head-lines-so-a-pass-can-rest-on-a-task-nobody-built-from-the-branch-ar0311-f6-confirmed/findings.md).

- Kind: fix
- Found by: 2026-10-25-worker-aa04e460 (worker), 2026-10-25
- Where: `packages/delivery/src/delivery.ts:52` (`refusal` gets no project), `:75` (the PASS push takes the review job's project)
- What: `refusal` now requires the task `reviewTask` builds for the worker, but not the spawn's project. `arthur spawn --kind review --project <other> '<that exact task>'` passes delivery's check when the other project's HEAD holds the ticket file [INFERENCE: read from the lines, not run]. Its prepare checks out the same sha, so the PASS still rests on the code that merges; but the PASS's `github.push` names the other project, where the branch is not.
- Suggestion: pass `project` from `beforeSpawn` into `refusal` and refuse a project other than the worker's, with a test that needs a second project repository in `review.test.ts`'s `load`. Out: anything about who may spawn a review.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: fix

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0357
- 2026-10-25: AR0431 approved under the owner's standing word (AR-D31), group 1 after AR0355; the owner: "always go with recommendation till the 8 am morning" (AR-D36)

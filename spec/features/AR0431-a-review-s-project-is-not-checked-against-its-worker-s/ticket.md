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

A review spawn is accepted only in its worker's own project, so a PASS's push names the project the branch is in; tested.

- Kind: fix

## Done means

- `beforeSpawn` passes the spawn's `project` into `refusal`, which refuses a review whose project is not its worker's, with the same refusal message. Test in `packages/delivery/test/review.test.ts` with a second project repository in `load`: the exact task spawned with `--project <other>` is refused and leaves no job record; the same task in the worker's project starts. It fails on main.
- `npm test` and `npm run check` pass; delivery's line budget may be raised by the lines needed (AR-D29).

## Scope

In:
- `packages/delivery/src/delivery.ts`, `packages/delivery/test/review.test.ts`.

Out:
- Who may spawn a review.

## Decisions

- 2026-10-25: Source: F1 of AR0357
- 2026-10-25: AR0431 approved under the owner's standing word (AR-D31), group 1 after AR0355; the owner: "always go with recommendation till the 8 am morning" (AR-D36)

# AR0357 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A review's project is not checked against its worker's

- Kind: fix
- Found by: 2026-10-25-worker-aa04e460 (worker), 2026-10-25
- Where: `packages/delivery/src/delivery.ts:52` (`refusal` gets no project), `:75` (the PASS push takes the review job's project)
- What: `refusal` now requires the task `reviewTask` builds for the worker, but not the spawn's project. `arthur spawn --kind review --project <other> '<that exact task>'` passes delivery's check when the other project's HEAD holds the ticket file [INFERENCE: read from the lines, not run]. Its prepare checks out the same sha, so the PASS still rests on the code that merges; but the PASS's `github.push` names the other project, where the branch is not.
- Suggestion: pass `project` from `beforeSpawn` into `refusal` and refuse a project other than the worker's, with a test that needs a second project repository in `review.test.ts`'s `load`. Out: anything about who may spawn a review.
- Status: open

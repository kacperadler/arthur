# AR0586 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A worker is told to run `arthur ci`, but a job's CLI has no `ci` command

- Kind: fix
- Found by: 2026-10-30-worker-748174f6 (worker), 2026-10-30
- Where: the worker's task and steer ("arthur ci arthur/2026-10-30-worker-748174f6 --project arthur")
- What: inside the job, `arthur ci arthur/2026-10-30-worker-748174f6 --project arthur` prints `arthur: unknown command ci` in the worktree (no `arthur.config.ts` there). Run from the main checkout it prints `inside a job, not loaded: github, telegram: each names an env variable, and a job's CLI reads no env file`, then `unknown command ci`. The worker also cannot push, so its branch's tip has no CI run it could read.
- Suggestion: either the coordinator runs `arthur ci` after it pushes the worker's branch and leaves the step out of a worker's task, or the github plugin's read-only `ci` command loads in a job without the token, reading the public Actions API. A job still never reads the env file.
- Status: deferred (client summary)

## F2. test/report-check.test.ts is 222 lines

- Kind: test
- Found by: 2026-10-30-review-ea487137 (review 2, not blocking)
- What: the 200-line rule counts source files, not tests.
- Status: deferred (client summary)

## F3. frame(900) runs outside the try that removes the copy and the frame page

- Kind: fix
- Found by: 2026-10-30-review-ea487137 (review 2, not blocking)
- What: `.agents/arthur/criteria/report.md:178`: the same pattern as the copy's own write before this branch.
- Status: deferred (client summary)

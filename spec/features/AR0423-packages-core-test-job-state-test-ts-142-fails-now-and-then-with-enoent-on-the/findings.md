# AR0423 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The failure was never seen under the ticket's load loop

- Kind: test
- Found by: 2026-10-26-review-ffbb74a6 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/test/job-state.test.ts`
- What: the reproduction rests on a 300 ms pause added in `wrapper.ts`, not on the load loop.
- Status: dropped (the pause reproduces the exact error; the ticket accepts it)

## F2. The new comment spans two lines

- Kind: refactor
- Found by: 2026-10-26-review-ffbb74a6 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/test/job-state.test.ts:49-50`
- What: the criteria ask for one-line comments.
- Status: dropped (style only)

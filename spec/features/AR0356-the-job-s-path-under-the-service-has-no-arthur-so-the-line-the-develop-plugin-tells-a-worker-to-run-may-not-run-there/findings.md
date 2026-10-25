# AR0356 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `job-state.test.ts:142` failed once with ENOENT in a full run

- Kind: test
- Found by: 2026-10-25-review-9f53a5d9 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/test/job-state.test.ts:142`
- What: ENOENT on `…/active`; alone 14/14, a second full run passed.
- Status: ticket AR0423

## F2. The worker's help hint has no test

- Kind: test
- Found by: 2026-10-25-review-9f53a5d9 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/develop/src/plugin-new.ts:129`
- What: putting back `arthur plugin --help` passes the test.
- Status: dropped (a hint in prose; the line the worker runs is tested)

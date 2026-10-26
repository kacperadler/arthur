# AR0448 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. One wait message serves two jobs

- Kind: test
- Found by: 2026-10-26-review-0639bc8d (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/test/machine.test.ts:744`
- What: a timeout would not say which of the two jobs it waited for.
- Status: dropped (wording only)

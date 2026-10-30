# AR0587 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. test/report-check.test.ts is 225 lines

- Kind: test
- Found by: 2026-10-30-review-ad825df0 (review 1, not blocking)
- What: it was 222 before; the 200-line rule counts source files.
- Status: deferred (client summary)

## F2. With no browser found, CHROME is undefined and spawnSync drops it

- Kind: test
- Found by: 2026-10-30-review-ad825df0 (review 1, not blocking)
- What: the no-browser path behaves as before.
- Status: deferred (client summary)

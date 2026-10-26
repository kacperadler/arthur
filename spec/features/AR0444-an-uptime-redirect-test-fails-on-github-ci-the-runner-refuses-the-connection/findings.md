# AR0444 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Other uptime tests still ask `localhost`

- Kind: test
- Found by: 2026-10-26-review-a12d4016 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/uptime/test/uptime.test.ts:137,160,176,220`
- What: they ask `localhost`, which may resolve to `::1` first on a runner.
- Status: dropped (they run with Node's default of trying every address, so `::1` first does not break them)

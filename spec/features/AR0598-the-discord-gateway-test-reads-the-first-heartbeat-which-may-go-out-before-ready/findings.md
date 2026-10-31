# AR0598 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. the test can still fail under heavy load

- Kind: fix
- Found by: 2026-10-31-review-e6b5cc53 (review), 2026-11-01
- Where: `packages/discord/test/gateway.test.ts:8`
- What: The 50-run loop passed 48 of 50 while `npm test` ran in parallel, and I did not capture why the two failed. Alone it passed 50 of 50, and with six loops at once 90 of 90. `[INFERENCE]` The likely cause is the 50 ms window for a heartbeat ACK: if one ACK arrives late, the connection closes with 4000 before the `closed === undefined` check. That would be a different line from the one this ticket fixes.
- Status: deferred (client summary)

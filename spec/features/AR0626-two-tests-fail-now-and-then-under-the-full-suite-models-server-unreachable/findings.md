# AR0626 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The discord gateway's first test fails now and then under the full suite: a 50 ms heartbeat

- Kind: test
- Found by: 2026-11-05-worker-bb65dcfc (worker), 2026-11-05
- Where: `packages/discord/test/gateway.test.ts:8`
- What: in the 6th of 8 full `npm test` runs in a row on d8d9fd8c, "identify asks for intents 33281 alone; a heartbeat with no ACK before the next closes with 4000 …" failed once (1485 pass, 1 fail); the other 7 runs passed it. The test sets `api.heartbeat = 50`, so the plugin closes with 4000 when the fake's ACK of one heartbeat is not handled within 50 ms of the next; under the full suite's load the event loop can lag that long. [INFERENCE] which assertion failed was not captured (the run's output was filtered to the summary lines); line 21 or 22 is the likely one.
- Status: open

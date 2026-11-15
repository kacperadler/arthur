# AR0652 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Uptime's "this machine offline" test hits its 20 s limit under the full suite's load

- Kind: test
- Found by: 2026-11-13-worker-e7442a45 (worker), 2026-11-13
- Where: `packages/uptime/test/uptime.test.ts:343`
- What: `npm test` on 2c686df3 failed this one test after 20014 ms (its time limit) while every other of 1813 tests passed; run alone, `node --import @arthur/core/testing --test packages/uptime/test/uptime.test.ts` passed 25 of 25. The branch does not touch uptime. Its rounds of real time (AR0671's F2 measured 3 to 14 s) leave little room under a loaded machine.
- Suggestion: drive the plugin's check rounds with faked timers or a shorter `limitSeconds` in the test, so it waits on no real seconds; nothing else of uptime changes.
- Status: deferred (client summary)

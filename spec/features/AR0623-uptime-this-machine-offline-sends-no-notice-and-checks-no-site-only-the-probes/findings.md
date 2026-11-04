# AR0623 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A discord menu test failed once under the full suite and passes alone

- Kind: test
- Found by: 2026-11-04-worker-a260185c (worker), 2026-11-04
- Where: `packages/discord/test/menu.test.ts:87`
- What: `npm test` on 6ba2b890 failed "no phone commands empties the menu; a refused PUT is one line without the token, the record unchanged, and the next start sets it" (34 ms, 1 of 1536); `node --import @arthur/core/testing --test packages/discord/test/menu.test.ts` then passed 12 of 12. This branch touches no discord file. Which assertion failed was not captured.
- Suggestion: run the file under load (`npm test` in parallel with a CPU hog) until it fails, read the assertion, and make the test wait for the state it asserts (likely the stop's write or the third PUT) instead of an earlier signal.
- Status: deferred (client summary)

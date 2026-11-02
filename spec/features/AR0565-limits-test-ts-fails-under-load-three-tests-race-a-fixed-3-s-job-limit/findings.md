# AR0565 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The commit subject uses scope core, not the ticket id

- Kind: chore
- Found by: 2026-10-30-review-f7ebb40d (review 1, not blocking)
- What: `test(core): ...` instead of `AR0565`; the worker says the commit hook refused its first subject.
- Status: deferred (client summary)

## F2. until now waits 60 s in every test of limits.test.ts, so a hung test takes 60 s to fail instead of 20 s

- Kind: test
- Found by: 2026-10-30-review-f7ebb40d (review 1, not blocking)
- What: `packages/core/test/limits.test.ts`: raised for the 24 s limit plus the 5 s grace; a cost only when something breaks.
- Status: deferred (client summary)

## F3. Test 3's fake agent relies on GNU date -r ... +%s%3N

- Kind: test
- Found by: 2026-10-30-review-f7ebb40d (review 1, not blocking)
- What: `packages/core/test/limits.test.ts`: if it fails, the agent spends at once, which still works.
- Status: deferred (client summary)

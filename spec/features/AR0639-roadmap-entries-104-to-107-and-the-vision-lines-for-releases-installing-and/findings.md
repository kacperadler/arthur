# AR0639 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A core comment still describes an install from npm

- Kind: docs
- Found by: 2026-11-06-worker-d03737be (worker), 2026-11-06
- Where: `packages/core/src/job-place.ts:21`
- What: the comment above `guardedPlaces` says the guarded install folder is "`node_modules` of an install from npm". Under the approved AR0128 plan (AR-D514) Arthur is never installed from npm, and the plan's "Not available directly" shows such an install does not start (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). AR0639's Scope leaves code out, so the comment stays.
- Suggestion: drop the clause `` `node_modules` of an install from npm`` from the comment, in entry 106's ticket (installing a release), which touches the install anyway. The code does not change.
- Status: open

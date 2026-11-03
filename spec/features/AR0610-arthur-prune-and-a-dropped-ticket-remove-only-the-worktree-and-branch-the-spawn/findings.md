# AR0610 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. a job whose project is no longer in the project list is now kept (`unknown project <name>; …`) instead of pruned

- Kind: fix
- Found by: 2026-11-04-review-e864a275 (review), 2026-11-04
- Where: `packages/core/src/job-records.ts:150`
- What: The worker's final message states this and `merge.test.ts` was updated for it, but such jobs will now pile up until the project comes back.
- Status: deferred (client summary)

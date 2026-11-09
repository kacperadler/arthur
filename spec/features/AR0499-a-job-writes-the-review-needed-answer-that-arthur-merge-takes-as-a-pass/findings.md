# AR0499 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. an answer saved at the old place before this merge is no longer read

- Kind: fix
- Found by: 2026-11-09-review-30f38b5f (review), 2026-11-09
- Where: `packages/delivery/src/review-needed.ts:45`
- What: A branch waiting on a `no review` from before the upgrade needs `arthur review-needed` run again. The worker says this too.
- Status: deferred (client summary)

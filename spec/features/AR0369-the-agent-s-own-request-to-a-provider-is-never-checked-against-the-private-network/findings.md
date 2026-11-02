# AR0369 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. a failed lookup in the prepare is untested

- Kind: fix
- Found by: 2026-11-02-review-34d9b0aa (review), 2026-11-02
- Where: `packages/models/src/models.ts:71`
- What: A lookup that fails there (for example `ENOTFOUND`) refuses the job with the raw resolver error, not the provider-named message.
- Status: deferred (client summary)

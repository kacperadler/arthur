# AR0749 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. a running job only sees `prefixes` as it was when its run started

- Kind: fix
- Found by: 2026-11-27-review-e1054cb4 (review), 2026-11-27
- Where: `packages/core/src/job-sandbox.ts:116`
- What: If the file was missing then, or `keep` replaced it during the run, the job gets EACCES. AR0744's check must treat an unreadable file as "refuse", not "pass". The plan and the final message both flag this.
- Status: deferred (client summary)

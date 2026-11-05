# AR0521 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. the cap counts raw log bytes, not the size of the JSON answer

- Kind: fix
- Found by: 2026-11-05-review-5792389f (review), 2026-11-05
- Where: `packages/core/src/remote-job.ts:109`
- What: A log full of characters that need escaping (quotes, control characters, sent as `\uXXXX`) can still produce an answer several times 512 KiB. The record files other than `log` are not counted either. For typical logs the answer is well under 1 MiB, but the 20 s limit is not guaranteed in the worst case.
- Status: deferred (client summary)

# AR0615 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. the setting is only put back when `checkConfig` runs, not passed to the git call

- Kind: fix
- Found by: 2026-11-04-review-47cb3975 (review), 2026-11-04
- Where: `packages/core/src/git-config.ts:37`
- What: It is not in `pins` as `-c core.useReplaceRefs=false`, so a job that sets it to `true` between the check and Arthur's git call is read for that call. This is the same kind of race AR0392 closed for `PINNED`.
- Status: deferred (client summary)

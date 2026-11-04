# AR0618 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. an assignment whose value is a command substitution still records nothing

- Kind: fix
- Found by: 2026-11-05-review-f940b141 (review), 2026-11-05
- Where: `packages/delivery/src/checks-extension.ts:97`
- What: With `TMPDIR=$(pwd)/tmp npm run check` the matcher found 0 runs, so the branch would still be refused with `no check`. The ticket's own example uses `$PWD`, which does match.
- Status: deferred (client summary)

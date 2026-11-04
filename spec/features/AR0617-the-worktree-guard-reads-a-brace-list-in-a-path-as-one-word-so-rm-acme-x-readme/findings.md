# AR0617 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. harmless large lists are now refused

- Kind: fix
- Found by: 2026-11-04-review-0dc4a3d9 (review), 2026-11-04
- Where: `packages/core/src/shell-braces.ts:7`
- What: Any command whose brace lists make more than 256 words is refused as unknown, read-only ones like `for i in {1..1000}` included. This is a deliberate trade-off and the refusal message names it.
- Status: deferred (client summary)

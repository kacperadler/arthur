# AR0495 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Roadmap entry 1 still says a source file has at most 200 lines

- Kind: docs
- Found by: 2026-10-31-worker-08a2d27a (worker), 2026-10-31
- Where: `spec/roadmap.md:27`
- What: entry 1's Delivers says "every source file at most 200 lines" and its Done means "a file of exactly 200 lines passes, 201 fails". Since AR0495 a 201-line file passes as yellow, and the cap is 250 for a file in `RED_FILES`. The ticket's Scope does not name `spec/roadmap.md`, so the branch left it.
- Suggestion: reword the two lines to the three zones (green to 200, yellow to 220 with a printed line, red to 250 only when listed in `RED_FILES`, never above), pointing at the styleguide's Shape; nothing else in the entry changes.
- Status: deferred (client summary)

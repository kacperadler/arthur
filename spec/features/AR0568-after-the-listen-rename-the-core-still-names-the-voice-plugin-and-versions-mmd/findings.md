# AR0568 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. No test reads versions.mmd

- Kind: test
- Found by: 2026-10-30-review-ff1b2d2c (review 1, not blocking)
- What: `docs/architecture/versions.mmd`: the four nodes were checked by reading the diagram.
- Status: deferred (client summary)

## F2. Roadmap entry 49's Done means still says "a voice note with no plugin enabled"

- Kind: docs
- Found by: 2026-10-30-review-ff1b2d2c (review 1, not blocking)
- What: `spec/roadmap.md` entry 49: a description, not the quoted line; fine as it is.
- Status: deferred (client summary)

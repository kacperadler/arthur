# AR0601 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. core-and-plugins.mmd has no uptime node

- Kind: docs
- Found by: 2026-11-01-worker-8b02a88b (worker), 2026-11-01
- Where: `docs/architecture/core-and-plugins.mmd:47-53`
- What: uptime (roadmap 98, built) is in the README's Features and diagram, `arthur.mmd`, `versions.mmd` and the vision's plugin table, but `grep -c uptime docs/architecture/core-and-plugins.mmd` prints 0: no node, no arrow to the client sites, not in the `first` class. The ticket named dokploy only, so the branch left it.
- Suggestion: an `uptime[uptime<br/>client sites over HTTP<br/>down and up notices]` node in the RES subgraph, `uptime -->|checks| sites[(client sites)]`, and `uptime` in the `first` class line; nothing else changes.
- Status: deferred (client summary)

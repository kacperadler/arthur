# AR0439 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The 19 provider keys are a fixed list

- Kind: fix
- Found by: AR0439 reviews 1 and 2 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/requirements.ts:13`
- What: a provider key omp reads that is not on the list gets no warning.
- Status: dropped (AR-D53: the list covers the providers in use and the doc page names it exactly)

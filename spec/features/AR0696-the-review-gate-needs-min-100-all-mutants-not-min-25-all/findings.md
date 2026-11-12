# AR0696 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. here a bare run of only 40 mutants took 1345 s, close to the 1500 s deadline

- Kind: fix
- Found by: 2026-11-12-review-a3449f67 (review), 2026-11-12
- Where: `test/mutate.ts:48`
- What: So reaching 100 will often take several resumed `npm run mutate` calls; the ticket's Goal expects this, and verify.md item 3 says to rerun.
- Status: deferred (client summary)

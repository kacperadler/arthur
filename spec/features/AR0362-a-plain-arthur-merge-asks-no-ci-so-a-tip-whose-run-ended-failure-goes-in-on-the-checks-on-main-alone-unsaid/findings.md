# AR0362 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The refusal reads `arthur merge: arthur merge merges only …`

- Kind: ux
- Found by: 2026-10-25-review-b12fbfb2 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/delivery/src/auto-merge.ts:56`
- What: a doubled prefix.
- Status: dropped (wording only; it does not mislead)

## F2. A failed run on an older commit refuses a plain merge while no run covers the tip

- Kind: ux
- Found by: 2026-10-25-review-b12fbfb2 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/delivery/src/auto-merge.ts`
- What: follows "a run on the branch's own commits", as `--auto` reads it.
- Status: dropped (the safe side; `--no-ci` on the owner's word passes it)

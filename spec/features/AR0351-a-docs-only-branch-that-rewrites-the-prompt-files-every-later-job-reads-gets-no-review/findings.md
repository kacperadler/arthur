# AR0351 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A project that moves its prompt files elsewhere is not covered

- Kind: security
- Found by: 2026-10-25-review-d1705291 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/delivery/src/delivery-options.ts:16`
- What: `prompts.vision` or a folder not named `roles/`/`criteria/` needs its own `review.alwaysReview` entry.
- Status: dropped (the ticket chose these patterns; no project of the owner moves them)

## F2. A nested `.agents/` folder does not match

- Kind: security
- Found by: 2026-10-25-review-d1705291 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/delivery/src/delivery-options.ts:16`
- What: only the root's `.agents/` matches.
- Status: dropped (the core reads `.agents/arthur/…` from the root only)

# AR0426 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A forwarded sticker, location or poll reaches the coordinator as a bare mark

- Kind: docs
- Found by: 2026-10-25-review-6cc78233 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/telegram/src/media-in.ts:36`
- What: Before, it got the `OTHER` reply; now `[forwarded from X]` alone, untested.
- Status: dropped (the coordinator learns a forward came, which is truer than the `OTHER` reply; nothing runs)

## F2. The doc edit is outside the ticket's Scope

- Kind: docs
- Found by: 2026-10-25-review-6cc78233 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/telegram/docs/telegram.md`
- What: Explained by the worker; the criteria require it.
- Status: dropped (required by the review criteria)

## F3. Header comment cut from 4 lines to 3

- Kind: docs
- Found by: 2026-10-25-review-6cc78233 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/telegram/src/media-in.ts`
- What: To keep the budget.
- Status: dropped (style only)

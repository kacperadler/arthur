# AR0371 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A new `spec/.board/` has the umask's mode until the `chmod`

- Kind: security
- Found by: 2026-10-25-review-2db8a0cd (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/board.ts:172-173`
- What: Between `mkdirSync` and `chmodSync` a group member could plant an entry; once per checkout.
- Status: dropped (on the VPS's user-private groups the group holds Arthur's user alone; the window is one call long, once per checkout)

## F2. A one-line `if` of about 165 characters in `write`

- Kind: security
- Found by: 2026-10-25-review-2db8a0cd (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/board.ts:69`
- What: Folded to keep lines net zero; `board.ts` is at 200 lines.
- Status: dropped (style only)

## F3. Unlike `ownHome`, a fixed `0o700`

- Kind: security
- Found by: 2026-10-25-review-2db8a0cd (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/board.ts`
- What: `ownHome` keeps the owner's bits.
- Status: dropped (fine for a folder only Arthur writes)

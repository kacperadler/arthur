# AR0363 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. No row covers a binary file that replaces an existing one

- Kind: test
- Found by: 2026-10-25-review-64ad40cc (reviewer, non-blocking note), 2026-10-25
- Where: `packages/delivery/test/review-needed.test.ts`
- What: A replaced binary file gives the same numstat line as an added one.
- Status: dropped (same path through the code; coverage only)

## F2. Moving the binary rule before the earlier review rules goes uncaught

- Kind: test
- Found by: 2026-10-25-review-64ad40cc (reviewer, non-blocking note), 2026-10-25
- Where: `packages/delivery/src/review-needed.ts:66`
- What: It would only change which reason a `review` answer names.
- Status: dropped (not a behavior a user relies on)

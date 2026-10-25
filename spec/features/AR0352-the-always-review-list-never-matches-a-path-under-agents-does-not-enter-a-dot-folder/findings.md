# AR0352 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. The shortened comment drops a few words

- Kind: docs
- Found by: 2026-10-25-review-37a9920d (reviewer, non-blocking note), 2026-10-25
- Where: `packages/delivery/src/delivery-options.ts:13-15`
- What: "which `ci-*.ts` covers" became "`ci-*.ts`" to fit the line budget.
- Status: dropped (the reviewer found it still reads correctly)

## F2. review-needed.test.ts is about 206 lines

- Kind: test
- Found by: 2026-10-25-review-c1bf47ac (reviewer, non-blocking note), 2026-10-25
- Where: `packages/delivery/test/review-needed.test.ts`
- What: Over 200 lines.
- Status: dropped (the 200-line rule covers source files, not tests)

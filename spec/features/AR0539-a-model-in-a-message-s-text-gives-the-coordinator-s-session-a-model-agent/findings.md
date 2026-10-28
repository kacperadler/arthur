# AR0539 - Findings

Notes from the reviews of AR0539, settled at the merge.

## F1. The header comment no longer lists the characters before an at-sign

- Kind: docs
- Found by: 2026-10-28-review-246c3604 (reviewer), 2026-10-28
- Where: `packages/orchestration/src/hand-over.ts`
- What: the two-line header comment was cut to keep the package in its line budget, so it no longer names the characters that may come before an at-sign; the regex below it still shows them.
- Status: dropped (the code is the list; the comment was cut to keep the line budget)

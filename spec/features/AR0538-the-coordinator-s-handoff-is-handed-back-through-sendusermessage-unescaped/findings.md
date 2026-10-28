# AR0538 - Findings

Notes from the reviews of AR0538, settled at the merge.

## F1. The compaction path has no handoff with an at-sign in its tests

- Kind: test
- Found by: 2026-10-28-review-61368954 (reviewer), 2026-10-28
- Where: `packages/session/test/session.test.ts`
- What: only the restart test sends a handoff with an at-sign; the compaction read-back calls the same `readBack`.
- Status: dropped (both paths call the one escaped function, whose test fails without the escape)

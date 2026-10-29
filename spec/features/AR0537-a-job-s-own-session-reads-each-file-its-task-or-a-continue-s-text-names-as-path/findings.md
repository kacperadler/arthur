# AR0537 - Findings

Notes from the reviews of AR0537, settled at the merge.

## F1. The review's own continue attached a system file

- Kind: security
- Found by: 2026-10-28-review-54c14739 (reviewer), 2026-10-28
- Where: `packages/core/src/job-control.ts`
- What: the hand-back message of round 2 quoted an at-sign path from review-1, and main's continue, still unescaped, attached that file to the review's session; the reviewer treated it as data.
- Status: dropped (this is the bug the merge fixes)

## F2. The core job-control test file is 709 lines

- Kind: chore
- Found by: 2026-10-28-review-54c14739 (reviewer), 2026-10-28
- Where: `packages/core/test/job-control.test.ts`
- What: already over 200 lines before this branch.
- Status: dropped (the 200-line rule covers source files, not tests)

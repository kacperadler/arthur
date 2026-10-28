# AR0479 - Findings

Notes from the reviews of AR0479, settled at the merge.

## F1. A python3 failure before the first step is not retried

- Kind: fix
- Found by: 2026-10-29-review-ebd6b052 (reviewer), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:11`
- What: the retry runs only on the read after a step; one failed call on the first look still costs every clone `.git` that existed then. As the ticket asked, and no worse than before.
- Status: deferred (client summary)

## F2. A folder that stays loses the sandbox warning

- Kind: ux
- Found by: 2026-10-29-review-ebd6b052 (reviewer), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:14`
- What: the "could not be removed (<why>)" line now gives only the python3 reason, not that a git call there would run its config outside any sandbox.
- Status: deferred (client summary)

## F3. Two very long lines in `sweep`

- Kind: chore
- Found by: 2026-10-29-review-ebd6b052 (reviewer), 2026-10-29
- Where: `packages/delivery/src/merge-sweep.ts:11,14`
- What: the retry and the reason choice are packed into two long lines to stay within delivery's 1631-line budget.
- Status: dropped (allowed by the styleguide; the budget is the owner's)

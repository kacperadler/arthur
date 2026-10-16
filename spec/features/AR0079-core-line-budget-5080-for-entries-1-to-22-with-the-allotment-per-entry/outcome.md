# AR0079 - Outcome

- Merged: 2026-10-16, `bc338cb`
- Branch: h/2026-10-16-ar0079-core-budget-5080-45addcb8
- Reviews: review-1.md PASS
- Cost: worker $1.05, reviews $0.38; review rounds 1

## What went in

- `test/structure.test.ts`: core 4812 and core/testing 268 (5080 for entries 1 to 22), the allotment per entry in its comment (16: 250, 21: 350, 22: 200, bugs 95, 9 used); `test/structure.ts` counts `testing.ts` and `fake-agent.ts` toward the kit's budget.

## Checks on main

- `npm run check`: passed.
- `npm test`: 272/272 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

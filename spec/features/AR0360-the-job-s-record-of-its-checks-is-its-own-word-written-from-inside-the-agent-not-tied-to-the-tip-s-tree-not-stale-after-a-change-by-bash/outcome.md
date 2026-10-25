# AR0360 - Outcome

- Merged: 2026-10-25, `694dcd74`
- Branch: arthur/2026-10-25-worker-009bdb40
- Reviews: review-1.md PASS
- Cost: worker $1.90, reviews n/a; review rounds 1

## What went in

- `packages/delivery/src/checks-extension.ts`: each checks line ends with the worktree's commit and `clean` or `dirty` as the call ends; outside Git no line; edits no longer add lines.
- `packages/delivery/src/review-needed.ts`: for each script, only the latest line on the tip's clean tree counts; otherwise `review: … the job's checks ran on <commit>, not the tip` or `… on a dirty tree`; old-format lines count as no checks.
- `packages/delivery/docs/commands/review-needed.md`, `README.md`: say so, and that the lines are the job's own word while the sandbox lets it write them.
- `packages/delivery/test/checks.test.ts`, `review-needed.test.ts`: clean and dirty trees, an older commit, a later run elsewhere, old lines.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1124/1124 passed.

## Left open

- Tickets from findings: AR0436 (F1 and the review's notes; approved under AR-D31, group 2).

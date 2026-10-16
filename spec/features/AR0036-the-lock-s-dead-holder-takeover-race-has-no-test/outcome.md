# AR0036 - Outcome

- Merged: 2026-10-16, `73aa034`
- Branch: h/2026-10-16-ar0036-lock-takeover-rac-cb936e0d
- Reviews: review-1.md PASS
- Cost: worker $1.27, reviews $0.42; review rounds 1

## What went in

- `packages/core/src/lock.ts`: a guard left by a crashed taker is cleared by the same takeover as a dead holder's lock (waiting on `<path>.takeover.takeover`, deleting only the same pid and inode); before, two takers could hold the guard at once.
- `packages/core/test/lock.test.ts`: 8 real processes race over 100 rounds with no overlapping hold, 50 more past a dead guard, and a single taker past a dead guard.

## Checks on main

- `npm run check`: passed.
- `npm test`: 108/108 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

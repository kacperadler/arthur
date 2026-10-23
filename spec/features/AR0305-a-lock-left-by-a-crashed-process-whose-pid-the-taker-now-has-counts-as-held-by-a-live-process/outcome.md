# AR0305 - Outcome

- Merged: 2026-10-23, `94846b2`
- Branch: h/2026-10-22-ar0305-eccb8bad
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.36, reviews $1.05; review rounds 2

## What went in

- `packages/core/src/lock.ts`: the process keeps an in-memory set of the lock files it holds (device and inode); a lock naming this pid that is not in the set is a dead holder's and is taken over, so `arthur run` restarted with the same pid in the same boot (a `docker restart`) starts and recovers what a crash left. The file format is unchanged. Budget core 5772.
- `packages/core/test/lock.test.ts`: three leftovers naming this pid are taken over by `takeLock` and `withLock`; a nested `withLock` on the same lock waits and refuses.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1045/1045 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.

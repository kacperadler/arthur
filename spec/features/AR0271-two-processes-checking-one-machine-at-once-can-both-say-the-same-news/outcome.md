# AR0271 - Outcome

- Merged: 2026-10-22, `92228a0`
- Branch: h/2026-10-22-ar0271-72a7b9ab
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $5.37, reviews $1.39; review rounds 3

## What went in

- `packages/resources/src/machine-free.ts`: `checkSample` reads the earlier check and writes its own under the core's `withLock` on `machines/<name>.json.lock`, so of two processes checking one machine only one says `disk-low` or a failure notice.
- `packages/resources/test/disk.test.ts`: a second process holds the lock and writes its own check; the test asserts no repeated news, the write happens inside the lock (a FIFO holds that gap open), and no lock file is left.
- `packages/resources/docs/resources.md`: notices and `disk-low` are said once, also across processes. Budget resources 607.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1021/1021 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0296 (F1).

# AR0401 - Outcome

- Merged: 2026-10-25, `a3642537`
- Branch: arthur/2026-10-25-worker-3ca726ff
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.92, reviews n/a; review rounds 2

## What went in

- `packages/orchestration/test/unix-socket.ts`: `NO_UNIX_SOCKET`, one probe at load that listens on a Unix socket in a test-owned temp folder and gives the skip reason `this host refuses a Unix socket (EACCES), so tmux cannot start a server`, or `false`.
- `packages/orchestration/test/coordinator.test.ts`, `inbox.test.ts`, `silent.test.ts`: the tests that start a tmux server (12, 24 and 1) skip on that reason inside a job's sandbox; the others still run there.
- `packages/core/test/testing.test.ts`: the kit's tmux-server test skips on the same probe, copied inline since the core imports no plugin.
- Reviews: review-1 FAIL (two inbox restart tests skipped though they start no tmux), fixed; review-2 PASS. Merged on the owner's standing AR-D11.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1105/1105 passed.

## Left open

- Tickets from findings: AR0412 (F1, F4).

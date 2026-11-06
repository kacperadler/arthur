# AR0631 - Outcome

- Merged: 2026-11-06, `90fae4df`
- Branch: arthur/2026-11-06-worker-8f4c1f10
- Reviews: none
- Cost: worker $2.26, reviews $0.00; review rounds 0

## What went in

- packages/core/src/remote-job.ts: `records` skips a record entry that is gone between its listing and its stat (a lock another copy or the wrapper holds for a moment) instead of failing with ENOENT.
- packages/core/test/machine.test.ts: the "copy brings only the log's new bytes" test puts a broken lock symlink in the remote record, so it fails if `records` stats a gone entry, and it waits for its job to end before it finishes.
- packages/discord/test/gateway.test.ts: the heartbeat test uses a 1000 ms interval, so event-loop lag under the full suite no longer runs the next heartbeat before the ACK is read; it still fails when the close for a missing ACK is removed.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1512/1583 passed.

## Left open

- Findings: none; no findings.md on this ticket.

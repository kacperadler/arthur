# AR0631 - Two tests fail now and then under the full suite: the discord 50 ms heartbeat, and the machine copy of only the log new bytes

```json
{
  "id": "AR0631",
  "title": "Two tests fail now and then under the full suite: the discord 50 ms heartbeat, and the machine copy of only the log new bytes",
  "date": "2026-11-05"
}
```

## Description

Two tests pass when run alone, and in most full runs, but fail now and then under the full suite. Each failure costs a rerun of CI or of a worker's checks. After this change, each test waits for the state it asserts, with no race against the suite's load.

## Goal

Evidence:
- `packages/discord/test/gateway.test.ts:8` failed once in 8 full `npm test` runs in a row (AR0626 finding F1), and again in the AR0521 worker's first run on 2026-11-05. It sets `api.heartbeat = 50`, so the plugin closes the connection with 4000 when it has not handled the fake's ACK of one heartbeat before the next, 50 ms later. Under the full suite's load the event loop can lag that long. Which assertion fails was not captured.
- `packages/core/test/machine.test.ts:742` ("a copy brings only the log's new bytes …") failed once in main's CI at c9b04b4 on 2026-11-05 with ENOENT on a `state.lock`, then passed on rerun. Two likely causes, unconfirmed: the two sweeps at once on line 751 racing over the same lock file, or the test ending (line 761 opens the gate) without waiting for its job to end, so the job still writes in a folder being removed.

- Kind: test

## Done means

- Each test's failure is reproduced first, under load (for example `node --test` with a busy loop beside it, or the full suite repeated), and its cause is named in the final message with the failing assertion or stack.
- The heartbeat test no longer fails on event-loop lag. Possible ways: a fake that holds the ACK only where the test means it to, or an interval long enough for the load; the test still fails if the close for a missing ACK is removed.
- The machine test no longer races. If the race is in the code (two copies at once over one lock), the code is fixed, not the test.
- 10 full `npm test` runs in a row pass both tests.
- The project's checks pass.

## Scope

In:
- `packages/discord/test/gateway.test.ts`.
- `packages/core/test/machine.test.ts`.
- `packages/core/src/machine-sync.ts`, only if the ENOENT is a race in the copy itself.

Out:
- Other tests that flake: each one is its own ticket.

## Decisions

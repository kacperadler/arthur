# AR0283 - A job's question and the plugin's closes take the log's lock synchronously inside `arthur run`

```json
{
  "id": "AR0283",
  "title": "A job's question and the plugin's closes take the log's lock synchronously inside `arthur run`",
  "date": "2026-10-22",
  "after": [
    "AR0282"
  ]
}
```

## Description

`withLock` waits by blocking the process, up to 10 s, then throws. While an `arthur decision` in another process holds the lock (milliseconds normally), `arthur run`'s event loop stalls in the handler; a holder that hangs stalls it 10 s and costs that question its record (the notice goes without its id). [INFERENCE] from the lock's code; not reproduced.

## Goal

Recording a job's question and closing questions no longer block `arthur run` on the log's lock, so a held lock cannot stall the running daemon.

- Kind: risk

Evidence:
- `packages/orchestration/src/decision-log.ts` (`change`, `withLock`), called from the `job-state` and `ticket-moved` handlers in `decision-hooks.ts` and `blocked-notice.ts`
- Found by: 2026-10-22-ar0281-decision-log-fa71d0e0 (worker), 2026-10-22

## Done means

- The fix, with a test that proves it: take the lock with `queueLock` in the plugin's own handlers (the notice emitted after the ask resolves), keeping `withLock` for the commands.
- `npm test` and `npm run check` pass.

## Scope

In:
- take the lock with `queueLock` in the plugin's own handlers (the notice emitted after the ask resolves), keeping `withLock` for the commands.

## Decisions

- 2026-10-22: Source: F2 of AR0281
- 2026-10-22: Coordinator (free hand, finding ticket) approved.

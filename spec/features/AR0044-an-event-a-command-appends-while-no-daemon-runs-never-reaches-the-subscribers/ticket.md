# AR0044 - An event a command appends while no daemon runs never reaches the subscribers

```json
{
  "id": "AR0044",
  "title": "An event a command appends while no daemon runs never reaches the subscribers",
  "date": "2026-10-16"
}
```

## Description

`arthur run` follows the log from its end at the moment it takes the lock, and stops following when its plugins begin to stop. An `arthur spawn` or `arthur ticket` run while the daemon restarts (a deploy, a crash and the systemd restart, the stops of a slow plugin) appends its `job-started` or `ticket-moved`, and no daemon ever delivers it: entry 18's "`job-started` of a worker sets in-progress" is then missed for that job. [INFERENCE] from the lines: not reproduced against entry 18, which is not built.

## Goal

No event is lost across a daemon restart: an `arthur spawn` or `arthur ticket` run while `arthur run` is down still reaches every subscriber once the daemon is back, so the board (entry 18) never misses a `job-started`.

- Kind: security

Evidence:
- `packages/core/src/events.ts:52` (`fromEnd`), `packages/core/src/run.ts:35`
- Found by: 2026-10-16-ar0035-command-events-re-21f43133 (worker), 2026-10-16

## Done means

- `arthur run` keeps the number of the last event it delivered in `<home>/events.delivered` (written after each delivery, temp + rename). At start it delivers, in order, every event after that number, then follows; with no file (first start) it starts from the end as today.
- Each event is delivered once: never twice across a restart, including one that stopped mid-delivery (the number is written after the handlers ran).
- A test with real processes: stop the daemon, append events with a separate `arthur` process, start it again: the subscribers get exactly those events, once; a second restart delivers nothing again.
- Edge cases: the log cut by hand below the kept number (start from the end, one warning line); a kept number that is not a whole number (start from the end, one warning).
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/events.ts`, `run.ts`, their tests, `docs/commands/run.md`.

Out:
- A socket or a port.

## Decisions

- 2026-10-16: Source: F1 of AR0035
- 2026-10-16: Coordinator: the daemon replays from its kept number (option 1), not each consumer re-reading; a short restart's replay of a stale notice is the accepted cost.
- 2026-10-16: Coordinator: OK on at-least-once after a crash (SIGKILL mid-handlers redelivers that event; SIGTERM never does), the cost of writing the number after the handlers.
- 2026-10-16: Coordinator: OK on the replay running before any plugin start (not on the first 500 ms check).

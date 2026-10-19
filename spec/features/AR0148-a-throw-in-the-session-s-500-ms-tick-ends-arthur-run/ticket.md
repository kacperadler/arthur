# AR0148 - A throw in the session's 500 ms tick ends `arthur run`

```json
{
  "id": "AR0148",
  "title": "A throw in the session's 500 ms tick ends `arthur run`",
  "date": "2026-10-18"
}
```

## Description

the tick has no catch, and `arthur run` installs no `uncaughtException` handler (no match for it under `packages/`). A write that fails in `<home>/session/` (disk full, a folder made read-only), a `restarted.json` or `after-restart.md` that cannot be read, or `coordinator.restart` throwing, is an uncaught exception in a timer, which ends the Node process (`node -e 'setInterval(() => { throw new Error("tick") }, 10)'` exits 1), and with it every plugin and the coordinator's supervision. Entry 35's compaction tick had the same exposure before this ticket.

## Goal

An error in one tick of the session's clock is logged and the next tick runs, so `arthur run` keeps going.

- Kind: risk

Evidence:
- `packages/session/src/session.ts` (the `setInterval` in `start`), and the ticks it calls in `restart.ts`
- Found by: 2026-10-18-ar0144-a025af87 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: catch around each tick in `session.ts`, print `session: <what> failed: <first line>` once per distinct error, and go on at the next tick; a test that makes the session folder unwritable and sees `arthur run`'s plugins still running. Out: a host-wide handler in the core.
- `npm test` and `npm run check` pass.

## Scope

In:
- catch around each tick in `session.ts`, print `session: <what> failed: <first line>` once per distinct error, and go on at the next tick; a test that makes the session folder unwritable and sees `arthur run`'s plugins still running. Out: a host-wide handler in the core.

## Decisions

- 2026-10-18: Source: F1 of AR0144
- 2026-10-19: The owner (Telegram, 07:2x): 'nie czekaj tylko rób' on the night's findings and the /restart question; the coordinator recommended /restart ends arthur run while a restart is due, approved with the rest.

# AR0160 - `/restart` cannot clear a restart due, since it restarts only the coordinator's agent

```json
{
  "id": "AR0160",
  "title": "`/restart` cannot clear a restart due, since it restarts only the coordinator's agent",
  "date": "2026-10-19",
  "after": [
    "AR0148"
  ]
}
```

## Description

the code a merge changes runs in `arthur run` (every plugin, loaded once at its start); `/restart`, `/restart fresh` and the fresh start kill only the coordinator's tmux session, and `arthur run` starts the agent again with the same plugins loaded. So the restart guard of entry 37 is cleared only by a restart of `arthur run` itself (`systemctl --user restart arthur`), which the owner does over SSH; the phone command the config example once promised ("the phone commands below clear it") cannot. Entry 37's "a restart clears it" holds for a restart of `arthur run` (`packages/session/test/restart-guard.test.ts`, "a restart clears it").

## Goal

A restart due can be cleared from the phone: /restart restarts arthur run itself while one is due, so the new code really runs.

- Kind: improvement

Evidence:
- `packages/session/src/restart.ts` (`restart`), `packages/orchestration/src/orchestration.ts` (`coordinator.restart`)
- Found by: 2026-10-18-ar0153-0044a3b1 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: while a restart is due, `/restart` ends `arthur run` after the handoff, so the service manager (`Restart=always`, `docs/setup.md`) starts it again on the new code, and says so; refused, or the coordinator only, when `arthur run` runs without a service manager. Out: restarting a by-hand `arthur run`.
- `npm test` and `npm run check` pass.

## Scope

In:
- while a restart is due, `/restart` ends `arthur run` after the handoff, so the service manager (`Restart=always`, `docs/setup.md`) starts it again on the new code, and says so; refused, or the coordinator only, when `arthur run` runs without a service manager. Out: restarting a by-hand `arthur run`.

## Decisions

- 2026-10-19: Source: F1 of AR0153
- 2026-10-19: The owner (Telegram, 07:2x): 'nie czekaj tylko rób' on the night's findings and the /restart question; the coordinator recommended /restart ends arthur run while a restart is due, approved with the rest.

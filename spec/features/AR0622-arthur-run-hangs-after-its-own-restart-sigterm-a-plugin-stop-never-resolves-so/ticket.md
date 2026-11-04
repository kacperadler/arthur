# AR0622 - arthur run hangs after its own restart SIGTERM: a plugin stop never resolves, so the service never restarts and every plugin stays stopped

```json
{
  "id": "AR0622",
  "title": "arthur run hangs after its own restart SIGTERM: a plugin stop never resolves, so the service never restarts and every plugin stays stopped",
  "date": "2026-11-04"
}
```

## Description

After the restart guard ended the coordinator, `arthur run` sent itself SIGTERM and logged that it was stopping every plugin, but never exited: the service did not restart it on the new code, the restart stayed due, every spawn and review was refused, and the channels stayed stopped. `arthur run` must end within a bounded time once it stops, whatever one plugin's stop does.

## Goal

Evidence, 2026-11-04 (journal of `arthur.service`, times UTC):
- 15:43:05 `session: restart: done; ... arthur run ends, and its service starts it again on the new code`
- 15:43:05 `arthur run: SIGTERM: stopping uptime, dokploy, video, listen, discord, manage, resources, models, github, delivery, findings, commit-rules, projects, session, orchestration, schedule`
- 15:43:05 `orchestration: the coordinator ended; starting it again in 5 s`, 15:43:10 `orchestration: coordinator started` (orchestration restarted the coordinator while `arthur run` was stopping).
- Nothing after; at 15:46 `systemctl --user show arthur.service` still had the same MainPID 3903885 (`Ssl`, no signal pending), ActiveEnterTimestamp 13:46:27, and `arthur coordinator context` still said `Restart: due`. No job ran. Network to Discord and GitHub answered 200. Shortly before, 15:36-15:38, GitHub's API and Discord's API could not be reached (UND_ERR_SOCKET, UND_ERR_CONNECT_TIMEOUT), so a plugin's stop may be waiting on a request or socket with no time limit.
The vision: it runs on a VPS as a process its service starts again; a restart that never ends leaves the owner with no channel.

- Kind: fix

## Done means

- Find which stop hangs (a test with a fake plugin whose `stop` never resolves reproduces the hang first).
- `arthur run`, once it stops, ends within a bounded time even when a plugin's `stop` never resolves; the plugin is named in one log line. A test with that fake plugin fails before the change.
- Orchestration does not start the coordinator again once `arthur run` is stopping; a test proves it.
- `npm run check && npm test` pass.

## Scope

In:
- The core's run/stop path, and the plugin whose stop hangs once found.
- Orchestration's coordinator supervisor (no restart while stopping).

Out:
- The restart guard's rules (when a restart is due).

## Decisions

- 2026-11-04: AR0622 approved: run after AR0617, outside the 22-task counter; the owner: "AR-D495 - 1" (AR-D495)

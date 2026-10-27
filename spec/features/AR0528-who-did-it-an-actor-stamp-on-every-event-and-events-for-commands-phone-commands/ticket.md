# AR0528 - Who did it: an actor stamp on every event, and events for commands, phone commands, schedule runs and restarts

```json
{
  "id": "AR0528",
  "title": "Who did it: an actor stamp on every event, and events for commands, phone commands, schedule runs and restarts",
  "date": "2026-10-27"
}
```

## Description

Roadmap entry 99 of the plan: today an event names only the plugin that emitted it, and a shell command, a phone command (`/stopall`, `/steer`), a schedule entry firing and a restart leave no event. Built from the approved plan of AR0527 (`spec/features/AR0527-plan-an-activity-log-plugin-what-each-user-and-each-agent-or-the-harness-did-one/plan.md`, approved in AR-D203; the owner: not built on 2026-10-27).

## Goal

Every event says who acted (`by: { actor, on? }`: a user on a channel or the terminal, the coordinator, a project agent, a job, a plugin, Arthur) and on which messages, as the plan's section 1 sets out; new events `command-ran`, `phone-command`, `schedule-fired`, `run-started` (section 2).

- Kind: feat

## Done means

- Each actor in the plan's table is stamped, in the plan's order (job first); a test per actor.
- Each new event is emitted where the plan names, and never inside a job; a test each.
- Whether omp has a hook for typed terminal input is checked and reported (plan, Not available directly).
- Line budget raises for core (about 60), orchestration (about 20) and schedule (about 3) recorded as decisions.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/event-log.ts`, `events.ts`, `host.ts`, a new `actor.ts`, `cli.ts` (its command list moved to its own file), `plugin-host.ts`, `run.ts`, `docs/plugin-api.md`.
- `packages/orchestration/src/` (`provide("actor")`), `packages/schedule/src/sweep.ts`.

Out:
- The activity plugin and its views: the next two tickets.
- AR0502's check: its own ticket, which may use `on`.

## Decisions

- 2026-10-27: Source: the approved plan of AR0527 (AR-D203)

# AR0528 - Outcome

- Merged: 2026-11-06, `dd5907a9`
- Branch: arthur/2026-11-06-worker-8dfeac5d
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $13.87, reviews $1.22; review rounds 2

## What went in

- docs/plugin-api.md: under "Changes since entry 51", both main's AR0649 entry and this branch's AR0528 entry.
- test/structure.test.ts: core budget 7341 (main's 7273 + 68), orchestration 2761, schedule 621.
- packages/core/docs/commands/run.md: not described
- packages/core/src/actor.ts: not described
- packages/core/src/cli.ts: not described
- packages/core/src/core-commands.ts: not described
- packages/core/src/event-log.ts: not described
- packages/core/src/events.ts: not described
- packages/core/src/host.ts: not described
- packages/core/src/lock.ts: not described
- packages/core/src/plugin-host.ts: not described
- packages/core/src/run.ts: not described
- packages/core/src/wrapper.ts: not described
- packages/core/test/actor.test.ts: not described
- packages/core/test/cli.test.ts: not described
- packages/core/test/doctor.test.ts: not described
- packages/core/test/run.test.ts: not described
- packages/core/test/spawn.test.ts: not described
- packages/machines/test/machines.test.ts: not described
- packages/orchestration/src/actor.ts: not described
- packages/orchestration/src/orchestration.ts: not described
- packages/orchestration/test/actor.test.ts: not described
- packages/orchestration/test/silent.test.ts: not described
- packages/schedule/docs/commands/schedule.md: not described
- packages/schedule/src/sweep.ts: not described
- packages/schedule/test/registered.test.ts: not described
- packages/schedule/test/schedule.test.ts: not described
- packages/session/test/restart.test.ts: not described
- spec/features/AR0528-who-did-it-an-actor-stamp-on-every-event-and-events-for-commands-phone-commands/findings.md: not described

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1526/1597 passed.

## Left open

- Deferred (client summary): F1. Typed terminal input: omp has a `before_agent_start` event
- Deferred (client summary): F2. Events a plugin emits in its `stop` pull other processes' events into stopped plugins

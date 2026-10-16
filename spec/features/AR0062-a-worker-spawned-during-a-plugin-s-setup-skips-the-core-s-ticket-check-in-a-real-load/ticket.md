# AR0062 - A worker spawned during a plugin's `setup` skips the core's ticket check in a real load

```json
{
  "id": "AR0062",
  "title": "A worker spawned during a plugin's `setup` skips the core's ticket check in a real load",
  "date": "2026-10-16"
}
```

## Description

`host.jobs.spawn` is usable inside `setup`, before the core registers its `beforeSpawn` and its `job-started` move, so a worker spawned there runs on a `planning`, `merged` or unknown ticket and its ticket stays where it was. The fake host checks and moves such a spawn, so a test would not show it. [INFERENCE] from the lines, not run: no plugin spawns in `setup` today.

## Goal

A plugin cannot start a job before Arthur has finished loading, so no worker ever skips the core's ticket check.

- Kind: risk

Evidence:
- `packages/core/src/host.ts:36-45` (`loadPlugins` registers `refuseUnstartableTickets` and `moveStartedTickets` after every plugin's `setup`), `packages/core/src/testing.ts:167` (the fake host registers them at the first spawn)
- Found by: 2026-10-16-ar0060-fake-host-refuses-f4ebb0ee (worker), 2026-10-16

## Done means

- `host.jobs.spawn` called during a plugin's `setup` throws `<plugin>: spawn during setup; start jobs from start() or later`, in a real load and on the fake host; nothing is created. Spawns from `start` and later are unchanged.
- A test: a plugin whose `setup` spawns fails to load with that line; the fake host refuses the same.
- `npm test` and `npm run check` pass.

## Scope

In:
- `host.ts`, `plugin.ts` or `jobs.ts`, `testing.ts`, their tests, the plugin host docs.

## Decisions

- 2026-10-16: Source: F1 of AR0060
- 2026-10-16: Coordinator: refuse a spawn during setup (setup registers; start runs), not reorder the check.

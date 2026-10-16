# AR0060 - The fake host does not refuse a worker whose ticket cannot move to in-progress

```json
{
  "id": "AR0060",
  "title": "The fake host does not refuse a worker whose ticket cannot move to in-progress",
  "date": "2026-10-16"
}
```

## Description

in a real load, the core's `beforeSpawn` refuses a worker whose task names a ticket that is not on the board or cannot move to in-progress (AR0048). `fakeHost` registers no such check, so a plugin that spawns workers (delivery, schedule) sees its spawn of a worker on a `planning`, `merged` or unknown ticket succeed on the fake host and be refused in production. AR0047 moved only the `job-started` subscription, as its Done means names.

## Goal

The fake host refuses what production refuses: a plugin tested on it sees a worker on an unapproved or closed ticket refused, as in a real load. Both fake-host gaps (AR0047 F1 and F2) go in one change.

- Kind: risk

Evidence:
- `packages/core/src/host.ts:47` (`loadPlugins` registers the core's `beforeSpawn`), `packages/core/src/testing.ts:106` (`fakeHost` does not)
- Found by: 2026-10-16-ar0047-fake-host-moves-t-504c50d5 (worker), 2026-10-16

## Done means

- The core's `beforeSpawn` ticket check moves into `packages/core/src/board-jobs.ts` beside `moveStartedTickets`, and both `loadPlugins` and `fakeHost` register it; a fake-host test spawns a worker on a `planning` ticket and sees the refusal, nothing created.
- The fake host subscribes the core's ticket move after the plugin's `setup`, as `loadPlugins` does, so a plugin's own `job-started` handler sees the same status on both; a test shows the plugin's handler sees `planned` on the fake host, as in a real load. `docs` or the fake host's comment says a plugin must not rely on the status at `job-started` from another process.
- `npm test` and `npm run check` pass.

## Scope

In:
- `board-jobs.ts`, `host.ts`, `testing.ts`, their tests.

## Decisions

- 2026-10-16: Source: F1 of AR0047
- 2026-10-16: Coordinator: AR0061 (F2 of AR0047) is folded into this ticket.

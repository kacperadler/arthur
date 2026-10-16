# AR0047 - The fake host does not move a worker's ticket when the worker starts

```json
{
  "id": "AR0047",
  "title": "The fake host does not move a worker's ticket when the worker starts",
  "date": "2026-10-16"
}
```

## Description

in a real load, a worker's `job-started` moves each ticket its task names to in-progress. `fakeHost` builds its own bus, board and job runner without that subscription, so a plugin tested against it (delivery's hand-back, 55) sees its spawned worker's ticket stay in `planned`, unlike in production.

## Goal

A plugin tested on the fake host sees what it would see in production: a worker's start moves its ticket to in-progress there too.

- Kind: risk

Evidence:
- `packages/core/src/host.ts` (`loadPlugins` subscribes the core's board to `job-started`), `packages/core/src/testing.ts` (`fakeHost` does not)
- Found by: 2026-10-16-ar0021-board-transitions-76954a78 (worker), 2026-10-16

## Done means

- The `job-started` subscription that moves a worker's tickets lives in one exported core function beside `board()`, called by both `loadPlugins` and `fakeHost`.
- A fake-host test: a worker spawn on a planned ticket moves it to in-progress; a read-only kind moves nothing.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/host.ts`, `board.ts`, `testing.ts`, their tests.

## Decisions

- 2026-10-16: Source: F1 of AR0021

# AR0061 - On the fake host the core moves a worker's ticket before the plugin's own `job-started` handler runs; in a real load after

```json
{
  "id": "AR0061",
  "title": "On the fake host the core moves a worker's ticket before the plugin's own `job-started` handler runs; in a real load after",
  "date": "2026-10-16"
}
```

## Description

`loadPlugins` subscribes the core's move after every plugin's `setup`, so in the process that spawns, a plugin's `job-started` handler runs while the ticket is still `planned`. `fakeHost` subscribes it before the test calls the plugin's `setup`, so there the plugin's handler sees `in-progress`. [INFERENCE] No plugin reads a ticket's status in its `job-started` handler yet; one that does would pass on the fake host and see `planned` in an in-process spawn of the daemon.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: risk

Evidence:
- `packages/core/src/testing.ts:125`, `packages/core/src/host.ts:57`, `packages/core/src/events.ts:48` (handlers run in the order they subscribed)
- Found by: 2026-10-16-ar0047-fake-host-moves-t-504c50d5 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: decide which status a plugin's `job-started` handler may rely on (in a daemon following a spawn from `arthur spawn` it already sees `in-progress`), then either deliver the core's handler last on the fake host too or document that a plugin must not rely on the order.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide which status a plugin's `job-started` handler may rely on (in a daemon following a spawn from `arthur spawn` it already sees `in-progress`), then either deliver the core's handler last on the fake host too or document that a plugin must not rely on the order.

## Decisions

- 2026-10-16: Source: F2 of AR0047

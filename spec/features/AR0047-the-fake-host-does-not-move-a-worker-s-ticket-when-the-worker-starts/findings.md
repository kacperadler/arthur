# AR0047 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The fake host does not refuse a worker whose ticket cannot move to in-progress

- Kind: risk
- Found by: 2026-10-16-ar0047-fake-host-moves-t-504c50d5 (worker), 2026-10-16
- Where: `packages/core/src/host.ts:47` (`loadPlugins` registers the core's `beforeSpawn`), `packages/core/src/testing.ts:106` (`fakeHost` does not)
- What: in a real load, the core's `beforeSpawn` refuses a worker whose task names a ticket that is not on the board or cannot move to in-progress (AR0048). `fakeHost` registers no such check, so a plugin that spawns workers (delivery, schedule) sees its spawn of a worker on a `planning`, `merged` or unknown ticket succeed on the fake host and be refused in production. AR0047 moved only the `job-started` subscription, as its Done means names.
- Suggestion: move the core's `beforeSpawn` check (with `STARTS`) into `packages/core/src/board-jobs.ts` beside `moveStartedTickets`, and call it from both `loadPlugins` and `fakeHost`; a fake-host test spawns a worker on a `planning` ticket and sees the refusal.
- Status: ticket AR0060

## F2. On the fake host the core moves a worker's ticket before the plugin's own `job-started` handler runs; in a real load after

- Kind: risk
- Found by: 2026-10-16-ar0047-fake-host-moves-t-504c50d5 (worker), 2026-10-16
- Where: `packages/core/src/testing.ts:125`, `packages/core/src/host.ts:57`, `packages/core/src/events.ts:48` (handlers run in the order they subscribed)
- What: `loadPlugins` subscribes the core's move after every plugin's `setup`, so in the process that spawns, a plugin's `job-started` handler runs while the ticket is still `planned`. `fakeHost` subscribes it before the test calls the plugin's `setup`, so there the plugin's handler sees `in-progress`. [INFERENCE] No plugin reads a ticket's status in its `job-started` handler yet; one that does would pass on the fake host and see `planned` in an in-process spawn of the daemon.
- Suggestion: decide which status a plugin's `job-started` handler may rely on (in a daemon following a spawn from `arthur spawn` it already sees `in-progress`), then either deliver the core's handler last on the fake host too or document that a plugin must not rely on the order.
- Status: ticket AR0060 (folded in; AR0061 dropped)

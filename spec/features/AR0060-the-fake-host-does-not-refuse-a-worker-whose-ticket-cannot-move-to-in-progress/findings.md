# AR0060 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A worker spawned during a plugin's `setup` skips the core's ticket check in a real load

- Kind: risk
- Found by: 2026-10-16-ar0060-fake-host-refuses-f4ebb0ee (worker), 2026-10-16
- Where: `packages/core/src/host.ts:36-45` (`loadPlugins` registers `refuseUnstartableTickets` and `moveStartedTickets` after every plugin's `setup`), `packages/core/src/testing.ts:167` (the fake host registers them at the first spawn)
- What: `host.jobs.spawn` is usable inside `setup`, before the core registers its `beforeSpawn` and its `job-started` move, so a worker spawned there runs on a `planning`, `merged` or unknown ticket and its ticket stays where it was. The fake host checks and moves such a spawn, so a test would not show it. [INFERENCE] from the lines, not run: no plugin spawns in `setup` today.
- Suggestion: decide whether `spawn` inside `setup` is allowed; if not, refuse it (`jobs.spawn` throws until the load ends); if so, register the core's check before the plugins' setups and keep only the move last. Out: the order of the `job-started` handlers.
- Status: ticket AR0062

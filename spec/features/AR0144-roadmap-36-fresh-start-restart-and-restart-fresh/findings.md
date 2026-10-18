# AR0144 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A throw in the session's 500 ms tick ends `arthur run`

- Kind: risk
- Found by: 2026-10-18-ar0144-a025af87 (worker), 2026-10-18
- Where: `packages/session/src/session.ts` (the `setInterval` in `start`), and the ticks it calls in `restart.ts`
- What: the tick has no catch, and `arthur run` installs no `uncaughtException` handler (no match for it under `packages/`). A write that fails in `<home>/session/` (disk full, a folder made read-only), a `restarted.json` or `after-restart.md` that cannot be read, or `coordinator.restart` throwing, is an uncaught exception in a timer, which ends the Node process (`node -e 'setInterval(() => { throw new Error("tick") }, 10)'` exits 1), and with it every plugin and the coordinator's supervision. Entry 35's compaction tick had the same exposure before this ticket.
- Suggestion: catch around each tick in `session.ts`, print `session: <what> failed: <first line>` once per distinct error, and go on at the next tick; a test that makes the session folder unwritable and sees `arthur run`'s plugins still running. Out: a host-wide handler in the core.
- Status: open

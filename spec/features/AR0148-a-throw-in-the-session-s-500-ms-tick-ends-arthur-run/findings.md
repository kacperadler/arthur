# AR0148 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A `/restart` whose restart throws in the tick tells the owner nothing

- Kind: bug
- Found by: 2026-10-19-ar0148-daa7de8b (worker), 2026-10-19
- Where: `packages/session/src/restart.ts:93-106` (`settle`), `packages/session/src/restart.ts:22-25` (`restart`)
- What: `/restart` with a coordinator running answers `...; Restarted. follows` and leaves the request for the tick. When the tick's `restart()` then throws (`restarted.json` cannot be written, or `coordinator.restart` throws), `settle` has already removed `request.json`, so after AR0148 the only trace is `session: restart failed: <first line>` in `arthur run`'s log, printed once per distinct error: no notice reaches the channel, `Restarted.` never comes, and a second `/restart` that fails the same way prints nothing new. Seen by reading the lines; not reproduced through a channel [INFERENCE].
- Suggestion: when `restart()` throws for a `/restart` (not the night's fresh start), emit a `notice` `restart: not done: <first line>` before rethrowing, so the owner who asked hears it; the night's fresh start stays as it is (logged, the next night tries again).
- Status: open

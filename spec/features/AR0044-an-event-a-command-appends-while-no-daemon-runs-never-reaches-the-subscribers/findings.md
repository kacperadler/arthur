# AR0044 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Roadmap entry 8 still says the events logged before the daemon started are not delivered

- Kind: cleanup
- Found by: 2026-10-16-ar0044-events-replay-aft-8791d5a8 (worker), 2026-10-16
- Where: `spec/roadmap.md:85`
- What: entry 8's Done means lists as edge cases "events logged before the daemon started are not delivered" and "no event from another process reaches a plugin once the stops begin". Since AR0044, `arthur run` delivers at its start every event after the number kept in `<home>/events.delivered` (only a first start begins at the log's end), and a plugin that emits during its stop gets the events appended before that one first, so the log's order and the kept number hold (`packages/core/docs/commands/run.md`).
- Suggestion: reword those two edge cases to match `run.md`; nothing else in the entry changes.
- Status: ticket AR0050

## F2. A log cut by hand and grown past the kept number while the daemon is down replays from the wrong place

- Kind: risk
- Found by: 2026-10-16-ar0044-events-replay-aft-8791d5a8 (worker), 2026-10-16
- Where: `packages/core/src/events.ts:112`
- What: at its start, `arthur run` compares the kept number only with the log's last number. When the log is cut by hand (numbers start again at 1) and more events than the kept number are appended before the next start, it delivers the new log's events after the kept number and skips the ones before it, with no warning. [INFERENCE] from the lines; not run.
- Suggestion: keep the delivered event's time (or its first bytes) beside its number and check that the log still holds that event before replaying; when it does not, start from the log's end with the same warning as a cut log. Out: any change to the log's format.
- Status: dropped: only a hand edit of the log reaches it, as F2 of AR0035 (AR0045 dropped); AR0051 dropped

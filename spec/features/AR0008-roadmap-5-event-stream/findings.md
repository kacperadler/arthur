# AR0008 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. An event a command emits reaches the log but not the daemon's subscribers

- Kind: improvement
- Found by: 2026-10-16-ar0008-event-stream-b32e80cb (worker), 2026-10-16
- Where: `packages/core/src/events.ts:32`
- What: `emit` delivers to the subscribers of its own process only. An event a command emits (`arthur ticket` writing `ticket-moved`, entry 17; `arthur spawn` writing `job-started`, entry 9) is appended to `.arthur/events.jsonl` with its number, but the plugins subscribed inside `arthur run` (telegram, delivery, orchestration) never get it. No roadmap entry says who carries an event from a command to the daemon; entry 18's "`job-started` of a worker sets in-progress" and entry 47's `notice` sending both depend on it whenever the emitter is a command. [INFERENCE] from the entries' text: none of them is built yet.
- Suggestion: decide in entry 8 (`arthur run`) that the daemon follows the log from the last number it delivered (`readEvents(fromSeq)` on a short timer or `fs.watch`) and delivers events whose line was written by another process; the emitting process keeps delivering its own at once. Out: a socket or any port.
- Status: open

## F2. The lock's dead-holder takeover race has no test

- Status: open
- Source: review-1.md of AR0008
- `packages/core/src/lock.ts`: concurrent takers of a dead holder's lock and a stuck `.takeover` guard from a crashed taker were checked by a throwaway script only. Pin both with a test of real concurrent processes before entry 17 (the board lock) relies on it.

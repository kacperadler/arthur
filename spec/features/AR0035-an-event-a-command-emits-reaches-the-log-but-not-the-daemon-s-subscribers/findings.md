# AR0035 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. An event a command appends while no daemon runs never reaches the subscribers

- Kind: risk
- Found by: 2026-10-16-ar0035-command-events-re-21f43133 (worker), 2026-10-16
- Where: `packages/core/src/events.ts:52` (`fromEnd`), `packages/core/src/run.ts:35`
- What: `arthur run` follows the log from its end at the moment it takes the lock, and stops following when its plugins begin to stop. An `arthur spawn` or `arthur ticket` run while the daemon restarts (a deploy, a crash and the systemd restart, the stops of a slow plugin) appends its `job-started` or `ticket-moved`, and no daemon ever delivers it: entry 18's "`job-started` of a worker sets in-progress" is then missed for that job. [INFERENCE] from the lines: not reproduced against entry 18, which is not built.
- Suggestion: decide whether a daemon delivers, at its start, the events appended since the last one an earlier daemon delivered, which needs that number kept under `.arthur/` (a replay of stale `notice` events is the cost), or whether each consumer re-reads what it missed through `host.events.read`. Out: a socket or a port.
- Status: ticket AR0044

## F2. A log cut by hand and grown past the old end between two follows loses events

- Kind: risk
- Found by: 2026-10-16-ar0035-command-events-re-21f43133 (worker), 2026-10-16
- Where: `packages/core/src/events.ts:66`
- What: the follower sees a cut log only when the file is smaller than the bytes it has read. When `events.jsonl` is emptied by hand and other processes append more than the old size within one follow (500 ms), the follower reads from the old byte offset in the middle of new lines, and the new numbers, which start again at 1, are below the next number it expects, so those events are not delivered. Hand edits of the log are the only way in.
- Suggestion: also start again from the end when the first line read from the old offset does not continue the numbers (its sequence number is below the next expected), or keep the file's inode and size and compare both.
- Status: dropped: only a hand edit of the log reaches it; the log is not edited by hand (YAGNI); AR0045 dropped

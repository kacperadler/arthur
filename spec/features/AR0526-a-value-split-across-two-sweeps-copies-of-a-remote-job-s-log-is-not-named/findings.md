# AR0526 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A value cut inside a remote log line longer than 256 KiB is still named in neither piece

- Kind: security
- Found by: 2026-10-29-worker-4242e88a (worker), 2026-10-29
- Where: `packages/core/src/machine-sync.ts:62`
- What: the sweep now copies a remote job's log up to its last line break and the rest at the next copy. A 256 KiB piece `arthur remote-job records` cuts that holds no line break at all is copied whole, or the copy would never move on (the test "a log grown by more than 1 MiB arrives whole over several copies" stalls without it). A value that cut splits is named in neither piece. `config.md` names this narrower gap.
- Suggestion: for a cut without a line break, hold back only the tail that may start a value, as `namedChunks` (`secret-names.ts`) does: it needs the values, so the bus's `hide` (`events.ts`, `Bus`) would carry `Hide` rather than a plain function. Out: the CLI's own stdout split across two writes.
- Status: open

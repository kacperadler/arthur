# AR0121 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The inbox drops a new message whose event number an old one had, after the event log is cut by hand

- Kind: risk
- Found by: 2026-10-18-ar0121-job-state-123cb6fe (worker), 2026-10-18
- Where: `packages/orchestration/src/inbox.ts:49` (`queue`)
- What: `queue` skips an event when `inbox/queued|turn|answered/<event number>` exists (the test "one event queued twice, and again after its file moved to turn/ and answered/, leaves one file" pins it), and files in `answered/` stay 7 days. A log cut or deleted by hand starts the numbers again (core test "numbers start again in the cut log", `packages/core/test/events.test.ts`), so within those 7 days a new owner message, job end or schedule action whose number an answered one had is never queued: the coordinator never sees it. The blocked notice of this ticket had the same hole and keys its mark by number and event time instead (`packages/orchestration/src/blocked-notice.ts`, commit 6d592bc).
- Suggestion: name an inbox file `<event number>-<event time in ms>` (or skip only when the queued file's own content and time match), keeping the order by number; the extension's reading of the names and the restart's matching of replies (`answers`) to files follow. Out: the log's numbering itself.
- Status: open

# AR0653 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. a time outside the range `Date` accepts crashes the view

- Kind: fix
- Found by: 2026-11-13-review-31754ff2 (review), 2026-11-13
- Where: `packages/stats/src/windows.ts:28`
- What: With `resetsAt` 179455663696508407 in `usage.json`, `host.clock.local(new Date(start))` throws. `arthur stats windows` then prints `arthur stats: Invalid time value` and exits 1, while `arthur usage` prints the same report (seen in a temporary folder). A report with an impossible reset or length should get a "no span" line instead.
- Status: deferred (client summary)

## F2. a window for one model tier (`tier: true`, e.g

- Kind: fix
- Found by: 2026-11-13-review-31754ff2 (review), 2026-11-13
- Where: `packages/stats/src/windows.ts:29`
- What: `Claude 7 Day (fable)`) that has a `durationMs` is compared with the spend on all of that provider's models. Its role shares then include spend that this window does not count.
- Status: deferred (client summary)

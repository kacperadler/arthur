# AR0368 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Two curl options share a line

- Kind: refactor
- Found by: 2026-10-25-review-8b32bb2a (reviewer, non-blocking note), 2026-10-25
- Where: `packages/models/src/probe.ts`
- What: `"silent", "show-error"` on one line to keep the count flat.
- Status: dropped (style only)

## F2. The test sets `http_proxy` only

- Kind: test
- Found by: 2026-10-25-review-8b32bb2a (reviewer, non-blocking note), 2026-10-25
- Where: `packages/models/test/models.test.ts:154-168`
- What: not `HTTPS_PROXY` or `ALL_PROXY`.
- Status: dropped (`noproxy = "*"` covers every proxy variable)

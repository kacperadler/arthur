# AR0350 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The coordinator's wording on a GitHub review names only the text under its first line

- Kind: docs
- Found by: 2026-10-26-review-dd52de48 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/orchestration/roles/coordinator.md:14`, `packages/github/src/github.ts:113`
- What: the first line also holds outside text (the pull request title, the login, the branch).
- Status: dropped (AR-D53: the general rule covers it as "a review"; narrower wording, not wrong)

## F2. The github wake still suggests an unquoted continue

- Kind: docs
- Found by: 2026-10-26-review-dd52de48 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/github/src/github.ts:95`
- What: the wake suggests `arthur continue <job> '<the failed step and its lines>'` with no quoting.
- Status: dropped (AR-D53: the coordinator's role now says how to quote; a hint only)

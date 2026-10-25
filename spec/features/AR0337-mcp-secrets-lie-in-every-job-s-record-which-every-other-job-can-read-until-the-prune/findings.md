# AR0337 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A glob inside the name before a suffix gets through

- Kind: security
- Found by: 2026-10-25-review-da1b019e (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/env-refusal.ts:79`
- What: `cat .mcp.js?n.bak` is allowed; the env file has the same gap.
- Status: dropped (Arthur writes no suffixed `.mcp.json`; the guard is not a sandbox, AR0376's is)

## F2. A blocked job whose wrapper dies is never swept, so its `mcp/` stays

- Kind: security
- Found by: 2026-10-25-review-af07bbfb (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/job-records.ts`
- What: the sweep ends only `working` or `idle` jobs.
- Status: dropped (a blocked job's run has ended, so its wrapper already removed `mcp/`)

## F3. The refusal's advice (`sed -i 's/^KEY=…'`) does not fit a JSON file

- Kind: ux
- Found by: 2026-10-25-review-9dfd0856 (reviewer, non-blocking note), 2026-10-26
- Where: `packages/core/src/env-refusal.ts`
- What: wording only.
- Status: dropped (wording only)

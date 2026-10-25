# AR0375 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The workflow test does not check what the top-level permissions grant

- Kind: test
- Found by: 2026-10-25-review-ff67b5de (reviewer, non-blocking note), 2026-10-25
- Where: `test/structure.test.ts:698`
- What: `contents: write` or `permissions: write-all` passes.
- Status: ticket AR0419

## F2. A `.yaml` workflow is not checked

- Kind: test
- Found by: 2026-10-25-review-ff67b5de (reviewer, non-blocking note), 2026-10-25
- Where: `test/structure.test.ts:692`
- What: the test reads `*.yml` only.
- Status: ticket AR0419

## F3. The `uses:` pattern fails safe on quoted pins

- Kind: test
- Found by: 2026-10-25-review-ff67b5de (reviewer, non-blocking note), 2026-10-25
- Where: `test/structure.test.ts`
- What: a quoted pin or `uses:` in a `run:` line fails the test rather than passing.
- Status: dropped (fails safe; nothing to fix)

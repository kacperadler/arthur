# AR0419 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A second top-level `permissions:` key passes

- Kind: test
- Found by: 2026-10-25-review-12911be4 (reviewer, non-blocking note), 2026-10-25
- Where: `test/structure.test.ts:692-702`
- What: `match` reads the first block only; a later or quoted `permissions:` with `contents: write` passes.
- Status: dropped (GitHub refuses a workflow with duplicate keys, so it would not run; inference of the reviewer)

## F2. The check is strict about form

- Kind: test
- Found by: 2026-10-25-review-12911be4 (reviewer, non-blocking note), 2026-10-25
- Where: `test/structure.test.ts:692-702`
- What: A trailing comment, CRLF or a flow mapping fails it.
- Status: dropped (fails safe)

## F3. A mutation of the `.yaml` filter is not caught

- Kind: test
- Found by: 2026-10-25-review-12911be4 (reviewer, non-blocking note), 2026-10-25
- Where: `test/structure.test.ts:692-702`
- What: The repository has no `.yaml` workflow.
- Status: dropped (built into a test of the real files)

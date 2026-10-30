# AR0577 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. That a signalled child leaves no slice is unproven

- Kind: test
- Found by: 2026-10-30-review-20dbb589 (review 1, not blocking)
- What: `packages/core/test/testing.test.ts`: the slice half needs a systemd user manager, which neither the worker's nor the reviewer's sandbox had; it goes through the same exit handler.
- Status: deferred (client summary)

## F2. GIT_AUTHOR_*, GIT_COMMITTER_* and EMAIL in the caller's environment still win over the kit's identity

- Kind: test
- Found by: 2026-10-30-review-20dbb589 (review 1, not blocking)
- What: `packages/core/src/test-env.ts`: the ticket asked only for `GIT_CONFIG_GLOBAL`.
- Status: deferred (client summary)

# AR0344 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The hidden-value line says "(capitals, digits and _)" for a value that has only those

- Kind: docs
- Found by: 2026-10-25-review-9f73291c (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/env.ts:102`
- What: For `YOUTRACK_TOKEN` the real problem is the missing `ARTHUR_` prefix; wording only.
- Status: dropped (the line still names the expected form `ARTHUR_<PLUGIN>_<WHAT>`)

## F2. A secret pasted with an `ARTHUR_` prefix is printed

- Kind: docs
- Found by: 2026-10-25-review-9f73291c (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/src/env.ts:102`
- What: Chosen by the ticket, so a wrong name of the owner's is shown.
- Status: dropped (the ticket's decision)

## F3. `env.test.ts` is 268 lines

- Kind: docs
- Found by: 2026-10-25-review-9f73291c (reviewer, non-blocking note), 2026-10-25
- Where: `packages/core/test/env.test.ts`
- What: Over 200 before this branch; tests do not count against the rule.
- Status: dropped (the structure test passes; tests are exempt)

# AR0458 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The secrets line carries a long trailing comment

- Kind: refactor
- Found by: 2026-10-26-review-f5263cdd (reviewer), 2026-10-26
- Where: `packages/core/src/wrapper.ts:122`
- What: the install comment moved to the end of the line to keep the file at 200 lines.
- Suggestion: none.
- Status: dropped (AR-D53: wording only)

## F2. The worktree guard still reads the record's guarded list on each tool call

- Kind: security
- Found by: 2026-10-26-review-f5263cdd (reviewer), 2026-10-26
- Where: `packages/core/src/job-place.ts:64`
- What: an install that empties `guarded` removes the guard's write refusals for the rest of the job; the Landlock sandbox still limits every write to the job's own paths.
- Suggestion: none.
- Status: dropped (AR-D53: Landlock already refuses the same writes; the env file stays hidden)

# AR0525 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. plugins' `[redacted]` still uses `host.secrets`, which holds only enabled plugins' values

- Kind: fix
- Found by: 2026-11-05-review-a290a81b (review), 2026-11-05
- Where: `packages/orchestration/src/credential.ts:8`
- What: An env-file value of a disabled plugin, or one no plugin reads, can therefore be written raw into a plugin's own files, such as the decision log, which do not go through `hide`. This is outside this ticket's scope (CLI output and a task's error).
- Status: ticket AR0638

# {{id}} - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Short title

- Kind: bug | risk | cleanup | improvement
- Found by: <job id> (worker | review | coordinator), YYYY-MM-DD
- Where: `path/to/file.ts:42`
- What: what was seen, and how to reproduce it.
- Suggestion: the change that would fix it, and what stays out.
- Budget: the USD a fix would need, such as 1.5; leave the line out when unknown
- Status: open | fixed in <commit> | ticket <id> | deferred (client summary) | dropped (<reason>)

# {{id}} - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), or `dropped (<reason>)`. `open` lives only until the merge, which turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket <id>`.

## F1. Short title

- Kind: bug | risk | cleanup | improvement
- Found by: <job id> (worker | review | coordinator), YYYY-MM-DD
- Where: `path/to/file.ts:42`
- What: what was seen, and how to reproduce it.
- Suggestion: the change that would fix it, and what stays out.
- Status: open | fixed in <commit> | ticket <id> | dropped (<reason>)

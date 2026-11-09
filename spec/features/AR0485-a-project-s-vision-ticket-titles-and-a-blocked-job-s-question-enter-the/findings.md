# AR0485 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `## Warnings` and the plugins' `## <plugin>` sections are still outside the quoted heading

- Kind: fix
- Found by: 2026-11-09-review-89983e1e (review), 2026-11-09
- Where: `packages/orchestration/src/context.ts:42`
- What: Warnings hold paths and an error's first line. A plugin's answer (for example the projects plugin's project lines, which come from the owner's config) is unquoted, though the role now calls everything Arthur adds data.
- Status: deferred (client summary)

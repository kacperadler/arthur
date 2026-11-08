# AR0661 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A quoted code block in a Before or After column loses its template literals' backticks and shows its fences

- Kind: fix
- Found by: 2026-11-08-worker-761965df (worker), 2026-11-08
- Where: `packages/manage/src/report-file.ts:98`
- What: `reportPage` runs each `> ` line of a `Before:` or `After:` column through the same inline rendering as the prose, so in a quoted TypeScript block a template literal such as `` console.log(`survived: ${mutant.file}`) `` shows as a grey chip with its backticks gone, and the ```` ```ts ```` and ```` ``` ```` fence lines show as typed. Seen in `spec/retro/2026-11-06.html` (proposals 1 and 4) at 420 px; the pyramid's page renders its columns the same way. A Markdown link (`[text](url)`) also shows as typed, in a column and in prose.
- Suggestion: render a column's lines inside a fence as escaped text only (no code chip, no bold) and leave the fence lines out; keep the inline rendering for a column of prose. Links stay out unless a page needs them.
- Status: open

# AR0557 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A group page can be another command's page

- Kind: fix
- Found by: 2026-10-29-review-2e1a9446 (review), 2026-10-29
- Where: `packages/core/src/commands.ts:52` (`groupPage`)
- What: `groupPage` takes any `<doc>-<word>.md` beside a command's doc. `packages/manage/docs/commands/` holds `retro.md` and `retro-due.md`, and `packages/delivery/docs/commands/` holds `review.md` and `review-needed.md`, so `arthur retro due --help` prints the page of `arthur retro-due`, and `arthur review needed --help` the page of `arthur review-needed`. [INFERENCE: from the lookup's code and these file names; not run.] Low risk: both pages are real pages of the same plugin.
- Suggestion: have the CLI skip a page that is another registered command's doc (`commands.docs()` holds them), or name group pages apart (`<doc>.<word>.md`). Leave the lookup's word check as it is.
- Status: deferred (client summary)

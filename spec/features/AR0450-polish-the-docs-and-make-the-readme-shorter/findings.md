# AR0450 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. arthur.mmd still shows the env file beside the config, and dates from 2026-10-22

- Kind: docs
- Found by: 2026-10-26-worker-79f8fb55 (worker), 2026-10-26
- Where: `arthur.mmd:15` (`files[/arthur.config.ts<br/>.env: secret values/]`), `arthur.mmd:1` and its legend (`state of main on 2026-10-21`)
- What: since AR0339 the env file is `~/.config/arthur/.env`, outside the config's folder, but the diagram's config node still draws `.env` beside `arthur.config.ts`; its header and legend dates predate today's merges (AR0441's `take-main`, the job sandbox's install and merge checks). The README now links this diagram (and the site's Diagram page draws it) instead of copying it. `arthur.mmd` was outside AR0450's Scope.
- Suggestion: label the node `arthur.config.ts<br/>env file outside it: secret values`, and refresh the header and legend dates from `spec/build.json`; nothing else in the diagram changes.
- Status: fixed in c6db0fcf

## F2. Two files outside the ticket's Scope changed

- Kind: process
- Found by: 2026-10-26-review-084bf1be (reviewer), 2026-10-26
- Where: `arthur.mmd`, `test/structure.test.ts`
- What: neither is in Scope's "In" list. The old structure test required the README's diagram to equal `arthur.mmd`, which the owner's AR-D87 (a small diagram) rules out, so it had to be replaced; `arthur.mmd`'s change is F1.
- Suggestion: none.
- Status: dropped (AR-D53: both changes follow from AR-D87 and F1; no risk)

## F3. The README line test assumes a final newline

- Kind: test
- Found by: 2026-10-26-review-084bf1be (reviewer), 2026-10-26
- Where: `test/structure.test.ts:777`
- What: `split("\n").length <= 121` lets a 121-line README without a final newline pass.
- Suggestion: count lines with the trailing newline trimmed.
- Status: dropped (AR-D53: one line over a soft limit is not a risk)

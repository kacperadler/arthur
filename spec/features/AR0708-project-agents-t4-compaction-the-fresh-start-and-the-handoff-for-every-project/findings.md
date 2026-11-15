# AR0708 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. arthur restart --project of a project without an agent restarts the coordinator without a word

- Kind: ux
- Found by: 2026-11-15-review-e8af8474 (review), 2026-11-15
- Where: `packages/session/src/restart-command.ts:46`
- What: `arthur restart --project acme`, acme having no project agent (no `orchestration.project({ chat })`, or a typo), falls back to the coordinator's session and restarts it; the reply names the coordinator but not why. `packages/session/docs/commands/restart.md` says "else the coordinator", so it is documented, but a typo ends the coordinator's conversation.
- Suggestion: refuse a `--project` that names a project without an agent, naming those with one (as `arthur attach <project>` does), with exit code 1; keep no `--project` meaning the coordinator. The phone command `/restart` stays as it is.
- Status: open

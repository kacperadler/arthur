# AR0530 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The commands `arthur log` hides are a fixed list in the activity plugin

- Kind: refactor
- Found by: 2026-11-13-worker-38c25313 (worker), 2026-11-13
- Where: `packages/activity/src/log-command.ts:14`
- What: `READ_ONLY` names the 20 commands (or command and first word) that only read, so `arthur log` and `/log` hide them unless `--all`. A plugin that adds a new command that only reads (or a new read-only subcommand of a group such as `ticket`, `machines`, `github`) shows up in the log until someone adds it to that list, the same risk the AR0527 plan names for the fixed list of logged events. The list also cannot tell `arthur machines` (reads) from `arthur machines update` (acts), so `machines` is left shown.
- Suggestion: let a command declare it in its registration, `readOnly?: true` beside `inJob` in `packages/core/src/commands.ts`, carried in `command-ran` (`readOnly: true`) and copied onto the activity line, so the plugin keeps no list. That changes the frozen plugin API, a decision; it stays out of this ticket's activity-only Scope.
- Status: deferred (client summary)

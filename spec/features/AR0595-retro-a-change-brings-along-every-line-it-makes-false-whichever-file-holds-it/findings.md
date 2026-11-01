# AR0595 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The autopilot criterion still says a fix never grows past its Scope

- Kind: docs
- Found by: 2026-11-01-worker-5177b15d (worker), 2026-11-01
- Where: `.agents/arthur/criteria/autopilot.md:18`, `packages/orchestration/criteria/autopilot.md:18`
- What: both say "The Scope names every file the change needs; a fix that grows past it is a new ticket, not a larger one." The worker role's "Stay inside the task" bullet (AR0595) now has a worker fix every line its change makes false in files the Scope does not name, unless the Scope's Out names them. A pre-approved ticket's Scope of at most 3 files can then grow on the worker's branch, while the coordinator judged it by that Scope. `arthur merge --auto` still refuses a held path (a role, the vision, CI, package.json, the always-review list: `packages/delivery/src/auto-merge.ts:46-48`), so a role or criteria edit still waits for the owner; a README, a doc page or a code comment does not. Both files are on the always-review list (`**/criteria/**`, `.agents/**`), which is why this branch leaves them as they are.
- Suggestion: the owner decides which holds for a pre-approved ticket: the criterion asks the coordinator to name in the Scope every file that states the changed behavior (and its Out for the rest), or the line says the worker's stale-line edits outside the Scope are part of the same fix. Out: the worker role, which this ticket set.
- Status: deferred (client summary)

## F2. the autopilot criterion clashes with the new rule

- Kind: fix
- Found by: 2026-11-01-review-940e09d4 (review), 2026-11-01
- Where: `spec/features/AR0595-retro-a-change-brings-along-every-line-it-makes-false-whichever-file-holds-it/findings.md:9`
- What: F1 is filed as `Status: open` for the owner to settle at merge. It is the owner's question, not a reason to fail this branch.
- Status: deferred (client summary)

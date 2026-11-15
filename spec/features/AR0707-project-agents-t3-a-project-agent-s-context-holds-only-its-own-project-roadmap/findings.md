# AR0707 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. removing the condition that writes the end mark only when a session was running at stop goes uncaught

- Kind: fix
- Found by: 2026-11-15-review-75cd5adf (review), 2026-11-15
- Where: `packages/orchestration/src/coordinator.ts:114`
- What: With `.status === 0` removed, `project-agents.test.ts` and `coordinator.test.ts` still pass: 22 passed, 0 failed, 14 skipped. Without the condition, `arthur run`'s stop would rewrite the mark of an agent already down, so `down since` would show the stop time instead of when the agent ended. The doc's step 5 promises the right behaviour, but no test holds it.
- Status: deferred (client summary)

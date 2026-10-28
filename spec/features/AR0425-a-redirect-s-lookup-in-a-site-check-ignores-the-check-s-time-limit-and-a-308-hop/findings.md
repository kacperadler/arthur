# AR0425 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A core limits test fails under load: its tool's process is not seen in time

- Kind: test
- Found by: 2026-10-28-worker-04c1fca5 (worker), 2026-10-28
- Where: `packages/core/test/limits.test.ts:144`
- What: in a full `npm test` while about ten other test runs from other worktrees shared the machine, "a timeout during a long tool call stops the agent and the tool's process; a kind that resumes at its budget is not resumed" failed after 21 s with `Error: timed out waiting for the tool's process`. The same file run alone right after (`node --import @arthur/core/testing --test packages/core/test/limits.test.ts`) passed 18 of 18. AR0425 does not touch the core.
- Suggestion: find what the test waits for at line 144 and why it can take over the wait under load; give that wait a bound that holds on a loaded machine, or make it wait on the state itself. The test's behavior stays as it is.
- Status: open

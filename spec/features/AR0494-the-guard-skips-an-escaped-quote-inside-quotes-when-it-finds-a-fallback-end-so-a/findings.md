# AR0494 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. limits.test.ts waits time out when the machine runs other suites

- Kind: test
- Found by: 2026-10-28-worker-444ea31a (worker), 2026-10-28
- Where: `packages/core/test/limits.test.ts:42`
- What: with two `npm test` runs at once in this worktree (and other worktrees' suites on the machine), each run failed one different test of this file with no change to it: "a timeout during a long tool call stops the agent and the tool's process…" (`timed out waiting for the tool's process`, line 144) and "an agent that ignores SIGTERM at its limit gets SIGKILL after the grace…" (`timed out waiting for the stop at the budget`, line 214). Run alone, `node --import=@arthur/core/testing --test packages/core/test/limits.test.ts` passed 18 of 18.
- Suggestion: give `until` in that file a deadline that holds under load (or one scaled from the budgets the test sets), so the suite does not fail when jobs run their checks side by side; the behaviors tested stay as they are.
- Status: deferred (client summary)

# AR0015 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. An agent that ignores SIGTERM runs on past its limit

- Kind: risk
- Found by: 2026-10-16-ar0015-job-limits-time-a-b27f47ad (worker), 2026-10-16
- Where: `packages/core/src/wrapper.ts` (`stopAgent`)
- What: a job at its time or budget limit gets SIGTERM to its process group and nothing more. An agent (or a tool process it waits on) that ignores SIGTERM keeps running, and spending, until it ends on its own; the record says `limit: time` or `limit: budget` only then. Reproduced in `packages/core/test/limits.test.ts`, "a job whose time runs out while it stops at its budget is not resumed": its agent runs `trap '' TERM` and goes on until the test writes its `go` file.
- Suggestion: roadmap entry 14's SIGKILL after a grace (and entry 13's scope) should also be what a limit stop uses, so a limit always ends the job; entry 14 lists "a job that ignores SIGTERM" as its edge case. Out: anything else in the wrapper.
- Status: ticket AR0053

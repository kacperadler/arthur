# AR0359 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A CI wait still cancels a hung run below the tip, whose end it no longer tells

- Kind: ux
- Found by: 2026-10-25-worker-e400170e (worker), 2026-10-25
- Where: `packages/delivery/src/ci-wait.ts:113`
- What: since AR0359, `delivery.ciEnded` counts only a run on the tip (`below === 0`), but a wait's round still cancels a run on any of the branch's own commits (`run.below >= wait.own`) once it has run 30 minutes. When it cancels a run 1 below the tip, that run's end reaches the coordinator through github's wake only, without `cancelled by delivery after it ran 30 minutes`, so the coordinator sees a cancel it did not ask for and no word of who did it. Reading of the lines; no test runs it.
- Suggestion: decide whether the wait should cancel only the tip's run (`run.below !== 0` in the round, and `own` then dropped from `Wait`), or keep cancelling a hung ancestor, which may hold the runner the tip's run waits for, and have `ciEnded` tell a run it cancelled at any depth. The plain merge's `own` reading stays as it is.
- Status: open

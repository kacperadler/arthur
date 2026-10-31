# AR0580 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A worker on another machine passes the review gate unchecked

- Kind: fix
- Found by: 2026-10-31-worker-f364e259 (worker), 2026-10-31
- Where: `packages/delivery/src/review-command.ts:126`, `packages/core/src/machine-sync.ts:27`
- What: the review gate (AR0580) reads the job's checks from `<home>/delivery/<job>/checks`, which the checks extension writes on the machine the job runs on. The sweep's copy from another machine brings only the record files in `RUN` (`machine-sync.ts:27`), never delivery's folder, so a job there has no lines here. Gating such a job would refuse every review of its branch for good, so `untested` asks nothing of a job whose `machine` is not `local`: its branch is reviewed without its checks, as before AR0580. `arthur review-needed` already answers `review` for it (`docs/commands/review-needed.md`, last line of "The job's checks").
- Suggestion: bring each registered extension's folder of a job back with its record (`arthur remote-job records` sends `<home>/<plugin>/<id>/` too), then drop the `machine === "local"` exemption in `untested`. The checks extension itself stays as it is.
- Status: open

## F2. The hand-back's stop after a second checks miss tells the coordinator to hand back findings

- Kind: ux
- Found by: 2026-10-31-worker-f364e259 (worker), 2026-10-31
- Where: `packages/delivery/src/hand-back.ts:51`
- What: when the worker's tip misses its checks a second time in a round, `tell` sends `Delivery's hand-back of arthur/<id> after FAIL <review> stopped: <refusal>. Hand it back yourself: arthur continue <id> '<the findings of <review>>', then arthur review <id> once it ends.` The worker already worked the findings; what is missing is the checks on its tip, so the advice names the wrong thing to send. Shown by the second-miss row of `packages/delivery/test/review.test.ts` ("a review starts only on a tip ...").
- Suggestion: let `tell` take the advice, and for a checks miss say `arthur continue <id> 'run npm run check, npm test and npm run mutate on your committed tip', then arthur review <id> once it ends.`; the other stops keep today's line. `delivery.ts` is at 200 lines and stays untouched.
- Status: open

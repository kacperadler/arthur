# AR0555 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A hand-back pending when its ticket is dropped tells the coordinator to continue a pruned job

- Kind: fix
- Found by: 2026-10-29-worker-b17e611d (worker), 2026-10-29
- Where: `packages/delivery/src/hand-back.ts` (the stop message), with `packages/delivery/src/delivery.ts` (the drop's prune, AR0555)
- What: a worker whose review FAILed waits in delivery's hand-back (for example at `maxAgents`); its ticket is dropped meanwhile; the drop now prunes the worker (its branch with `git branch -D`). At the next run's end the hand-back's continue is refused with `<id>: no such job in <home>/jobs`, and the coordinator gets `Delivery's hand-back of arthur/<id> after FAIL <review> stopped: <id>: no such job in .... Hand it back yourself: arthur continue <id> '<the findings of <review>>'`, a command that can only fail. Seen in `packages/delivery/test/review.test.ts` ("a refusal by the core or by delivery itself ...") before that test kept its worker with a draft in the worktree.
- Suggestion: the hand-back drops a pending entry whose ticket is dropped (or whose job is gone) without a wake, or says `its ticket <id> is dropped; nothing to hand back`. The drop's prune itself stays.
- Status: fixed in 16cc5224 (18081b3d only kept the worker, whose hand-back still ended with that message: review 2): a drop or a merge ends the hand-backs of its ticket's jobs, a FAIL of a dropped ticket that ends later is neither filed nor handed back, and a job of it that ends later is pruned as the drop prunes; tests in `packages/delivery/test/review.test.ts` ("a drop ends the hand-back ...", "a review in its run when its ticket is dropped ...").

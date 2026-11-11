# AR0691 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A restart may still end `arthur merge` during its push and its prune

- Kind: fix
- Found by: 2026-11-11-worker-32ad867e (worker), 2026-11-11
- Where: `packages/delivery/src/merge-command.ts:46-48`, `:71-74`
- What: `merge.lock`, which `delivery.merging` reads, is released at the end of `locked()`, before `github.push` and `pruneTicket` run in the same `arthur merge`. Main is merged and checked by then, so no rollback follows (`last-merge` names the commit), but a restart in that window ends a merge run from the coordinator's pane mid-push or mid-prune: main not pushed, the ticket's jobs left unpruned, and the after-merge procedure never printed to the coordinator.
- Suggestion: hold the lock (or a second marker `delivery.merging` reads) until the push and the prune are done, or have the next `arthur run` finish a push and prune a killed merge left; the rollback of AR0629 stays as it is.
- Status: open

## F2. The vision still says the fresh start waits only for jobs

- Kind: docs
- Found by: 2026-11-11-worker-32ad867e (worker), 2026-11-11
- Where: `spec/vision.md:70`
- What: the session row says "a fresh start at 23:00 once no job runs"; since AR0691 a running merge holds it too. The vision is the owner's, so the worker left it.
- Suggestion: the owner adds "and no merge" to that row, or leaves it as the summary it is.
- Status: open

## F3. `delivery.merging` ignores the boot id in `merge.lock`

- Kind: fix
- Found by: 2026-11-11-review-92a4b55f (review), 2026-11-11
- Where: `packages/delivery/src/merge-recovery.ts:61-63`
- What: `merging()` reads only the pid of `merge.lock`, while core's lock (`packages/core/src/lock.ts`, `holder`) also counts a lock an earlier boot wrote as dead. After a reboot, a lock whose pid now names another live process counts as a running merge, which holds a restart, until `arthur run`'s start takes the lock over (`passForward.start` → `recoverMerge`). Inside `arthur run` that is before its first 500 ms look; `arthur restart` run before `arthur run` starts is refused for that while.
- Suggestion: have core's `@arthur/core/lock` export whether a live process holds a lock (its own `holder` and `alive`), and use it in `merging()` instead of a second reading of the file.
- Status: open

## F4. A session test run once left a fake agent running

- Kind: test
- Found by: 2026-11-11-review-92a4b55f (review), 2026-11-11
- Where: `packages/session/test/`
- What: after one run of the session tests, a fake agent (`fake-agent.ts … -e …/handoff-extension.ts`) still ran about 50 minutes later under `/tmp/arthur-test-Y4i1vJ`; the reviewer stopped it, and which test started it is not known. The worker's runs afterwards (`pgrep -af fake-agent.ts` after a test that timed out) left none.
- Suggestion: have the core's test kit end, at exit, every fake agent a test started, as it ends the tmux servers a test left; then name the test whose `t.after` missed it.
- Status: open

# AR0570 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `arthur review` and the hand-back start a paid review of a branch merge.check refuses

- Kind: perf
- Found by: 2026-10-30-worker-0bc169b2 (worker), 2026-10-30
- Where: `packages/delivery/src/review-command.ts` (`arthur review`), `packages/delivery/src/hand-back.ts` (the next review after a FAIL)
- What: only `arthur review-needed` asks `merge.check` before a review (`packages/delivery/src/review-needed.ts:30-32`, this ticket). A review started with `arthur review <job>`, or by the hand-back after a FAIL, is paid for a worker branch that changes a `ticket.md`, `spec/decisions.jsonl` or `spec/build.json`, which `arthur merge` then refuses. Read from the code; not run.
- Suggestion: ask `merge.check` at the same gate T12 of AR0561's plan adds to `arthur review` and the hand-back (`tipChecks()`), and continue the worker with the refusal instead. Not in this ticket's Scope.
- Status: open

## F2. The coordinator's procedure tells the owner about a merge.check refusal the worker can fix itself

- Kind: docs
- Found by: 2026-10-30-worker-0bc169b2 (worker), 2026-10-30
- Where: `packages/delivery/docs/commands/merge.md:67`, `packages/orchestration/roles/coordinator.md:29`
- What: `merge.md` says for `refused by merge.check: …` "tell the owner", and `coordinator.md:29` names only `no review` and `review` as `arthur review-needed`'s answers. Orchestration's refusal of a branch that changes a `ticket.md`, the decision log or the board names its own fix (undo the change on the branch and commit), which an `arthur continue <job> '<the refusal>'` gets done without the owner.
- Suggestion: one line in each: a `merge.check` refusal of a worker's branch goes back to the worker with `arthur continue`, as a failed check on main does. Prose only; fits T16 of AR0561's plan.
- Status: open

# AR0570 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `arthur review` and the hand-back start a paid review of a branch merge.check refuses

- Kind: perf
- Found by: 2026-10-30-worker-0bc169b2 (worker), 2026-10-30
- Where: `packages/delivery/src/review-command.ts` (`arthur review`), `packages/delivery/src/hand-back.ts` (the next review after a FAIL)
- What: only `arthur review-needed` asks `merge.check` before a review (`packages/delivery/src/review-needed.ts:30-32`, this ticket). A review started with `arthur review <job>`, or by the hand-back after a FAIL, is paid for a worker branch that changes a `ticket.md`, `spec/decisions.jsonl` or `spec/build.json`, which `arthur merge` then refuses. Read from the code; not run.
- Suggestion: ask `merge.check` at the same gate T12 of AR0561's plan adds to `arthur review` and the hand-back (`tipChecks()`), and continue the worker with the refusal instead. Not in this ticket's Scope.
- Status: deferred (client summary)

## F2. The coordinator's procedure tells the owner about a merge.check refusal the worker can fix itself

- Kind: docs
- Found by: 2026-10-30-worker-0bc169b2 (worker), 2026-10-30
- Where: `packages/delivery/docs/commands/merge.md:67`, `packages/orchestration/roles/coordinator.md:29`
- What: `merge.md` says for `refused by merge.check: …` "tell the owner", and `coordinator.md:29` names only `no review` and `review` as `arthur review-needed`'s answers. Orchestration's refusal of a branch that changes a `ticket.md`, the decision log or the board names its own fix (undo the change on the branch and commit), which an `arthur continue <job> '<the refusal>'` gets done without the owner.
- Suggestion: one line in each: a `merge.check` refusal of a worker's branch goes back to the worker with `arthur continue`, as a failed check on main does. Prose only; fits T16 of AR0561's plan.
- Status: deferred (client summary)

## F3. Many shell routes write a ticket.md past the guard; merge.check stops them on the branch

- Kind: security
- Found by: 2026-10-30-review-d67293f2 (review 1, not blocking)
- What: `packages/core/src/worktree-guard.ts`: `cp -t`, `mv`, `rsync`, `rm -r` of the folder, `find -delete`, `git apply`, `patch`, `git merge`, `git cherry-pick`, `git reset --hard`, `python3 -c`, `tar -xf`, a variable as the path.
- Status: deferred (client summary)

## F4. On a case-insensitive file system, Ticket.md passes the guard and the check and reaches the real ticket

- Kind: security
- Found by: 2026-10-30-review-d67293f2 (review 1) and 2026-10-30-review-e1475616 (review 2), not blocking
- What: [INFERENCE] of the reviewers: macOS; on Linux it is another file.
- Status: deferred (client summary)

## F5. merge.check reads the job's branch again after CI, so a branch that moves mid-merge is judged at another commit

- Kind: risk
- Found by: 2026-10-30-review-d67293f2 (review 1, not blocking)
- What: [INFERENCE]: `packages/delivery/src/merge-command.ts:90` and `:132`; needs the job running again during a merge.
- Status: deferred (client summary)

## F6. A symlinked ticket folder passes and counts toward the next ticket id

- Kind: security
- Found by: 2026-10-30-review-e1475616 (review 2, not blocking)
- What: `spec/features/AC0002-forged` linked to `docs/forged`; it is not on the board unless `build.json` changes, which is refused.
- Status: deferred (client summary)

## F7. merge.check writes unreferenced trees and blobs into the object store on every run

- Kind: chore
- Found by: 2026-10-30-review-e1475616 (review 2, not blocking)
- What: `git gc` removes them.
- Status: deferred (client summary)

## F8. The commit subjects have no AR0570 scope

- Kind: chore
- Found by: 2026-10-30-review-e1475616 (review 2, not blocking)
- What: not a blocker under the review criteria.
- Status: deferred (client summary)

# AR0629 - Outcome

- Merged: 2026-11-05, `90e1b2e7`
- Branch: arthur/2026-11-05-worker-be6656d0
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $6.63, reviews $1.86; review rounds 3

## What went in

- `packages/delivery/src/pass-forward.ts`: starts `arthur merge --auto` in its own session (and a systemd scope with a unique probe and unit name where one can be made), with its output and exit status in `merge-runs/`. It wakes the coordinator when the merge ends, now or after a restart (5 s poll). A killed run whose merge commit is rolled back ends in the rerun's wake, not a wake of its own.
- `packages/delivery/src/merge-recovery.ts`: on a dead `merge.lock` whose HEAD is the dead job's own unchecked, unpushed two-parent merge commit, moves main to the first parent by compare-and-swap (`update-ref` with the old value, then `read-tree -m -u`, keeping the board). If Git refuses, it puts main back and tells the coordinator. Any dead lock it takes goes with its `merging`.
- `packages/delivery/src/delivery.ts`: `stop` also stops the end poll.
- `packages/delivery/src/merge-command.ts`: a comment now lists `merge-runs` among delivery's folders.
- `packages/delivery/docs/commands/merge.md`: "On its own" describes the detached merge, `merge-runs/`, the `killed before its end` wake, the compare-and-swap rollback and rerun, the cases left alone, and `merging` removed with a dead lock.
- `packages/delivery/test/review.test.ts`: tests for:
- `test/structure.test.ts`: delivery's line budget goes from 2085 to 2195.
- `spec/features/AR0629-a-delivery-merge-running-when-arthur-run-restarts-dies-half-done-leaving-an/findings.md`: F1, a merge run whose pid is reused after a reboot is never told.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1484/1555 passed.

## Left open

- Deferred (client summary): F1. A merge run whose pid another process took after a reboot is never told
- Deferred (client summary): F2. no test covers the probe and scope unit names, because this host has no user bus

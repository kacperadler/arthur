# AR0357 - Review 1

- Job: 2026-10-25-review-d6ecda42
- Branch: arthur/2026-10-25-worker-aa04e460
- Commit reviewed: 0050d31444c72c97dbeecc2fd448c021a5bef2bb
- Verdict: PASS

## Final message

No finding blocks the merge. The fix does what AR0357 asks, `npm ci`, `npm run check` and `npm test` all pass, and the tests catch every mutation of the new check that I tried.

**What I checked against the ticket**
- `packages/delivery/src/delivery.ts:125-129`: `refusal` now rebuilds the task with `reviewTask(host, worker(host, <id from Branch:>), round)` and lets the spawn through only on a byte-for-byte match. Otherwise it refuses with the exact message the ticket names. `worker()` covers "exists, is a worker, has ended". `branchOf` covers "the branch's tip is `Commit:`, the full sha". The `Ticket:` line and the final message are part of the compared bytes. Any error from `worker()` or `reviewTask` ends in the same one refusal.
- Branches are always `arthur/${id}` (`core/src/job-record.ts:77`, and `machine-sync.ts:60` enforces it), so building the worker id from `Branch:` never misses a real worker. A short id given in `Branch:` resolves the worker, but the rebuilt task names the full branch, so it is refused.
- `arthur review` (`review-command.ts:28`) and the hand-back (`hand-back.ts:83-84`) both spawn with the output of `reviewTask`, so they still start. The existing tests for both pass. An eval's review (`named`) never goes through a spawn, and its test passes unchanged.
- Timing: `prepare` checks out the sha that `refusal` just checked, and `arthur merge` compares the review's commit with the tip again. A tip that moves after the review starts cannot slip a PASS onto newer code.
- Tests in `review.test.ts` cover every case the ticket lists: hand-written with the real tip, another commit (main's HEAD and `f`×40), a 7-character sha, an extra newline, an edited final message, a worker running again, the old tip after a new commit. The rebuilt task starts and checks out the new tip. Each refusal is checked to leave no job record.
- Delivery's line budget goes to 1321 (+4, `delivery.ts` is +7 −3, now 174 lines). AR-D29 allows this, and the comment in `test/structure.test.ts` names AR0357.

**Notes (not blocking)**
- Finding F1, which the worker filed as open: `refusal` gets no `project`. So the exact task spawned by hand with another `--project` passes the check, and the PASS's `github.push` then names that other project. The review still checks out the same sha, so the PASS still rests on the code that merges. The ticket's Done means doesn't list the project, so this belongs in a follow-up ticket.
- The empty `catch {}` turns the specific reasons from `worker()` and `branchOf` ("in a run", "not in <root>") into the one generic refusal. The ticket asks for that single message. `arthur review` itself still prints the specific reasons, because it calls `worker()` and `reviewTask` before spawning.
- The worker's claims match what I see: the files, the 53/53 delivery tests and the mutations it reports. It skipped the full `npm test`; I ran it, results below.

**Checks I ran (in this checkout)**
- `npm ci`: 22 packages added.
- `npm run check` (`tsc`): exit 0.
- `timeout 900 npm test`: 1119 tests, 1061 pass, 0 fail, 58 skipped, exit 0.
- Mutations, each run against `packages/delivery/test/review.test.ts` (15 tests) and restored with `git checkout --`. My first batch of three ran in parallel on the same file and overwrote each other, so I threw those results away and reran each one alone:
  - Accept any task that builds (`built !== undefined`): 1 fail.
  - Compare the trimmed texts (`built?.trim() === task.trim()`): 1 fail.
  - Drop `round` from the rebuild (`undefined` instead of `round`): 1 fail.
  - Compare only the part above `## The worker's final message`: 1 fail.
  - Look up the worker by branch without `worker()`, so the running check is skipped: 1 fail, "Missing expected rejection: its worker in a run".
- `git status` was clean after every restore.

PASS
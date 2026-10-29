# AR0555 - Review 3

- Job: 2026-10-29-review-f78ad27b
- Branch: arthur/2026-10-29-worker-b17e611d
- Commit reviewed: 187b51a950207c71cb38809c7b896e89632fa68f
- Verdict: FAIL

## Final message

I ran the checks and five mutations. The fix for review 2's finding holds, but F1 is only half fixed, and the extra step the worker added has no test.

## Findings

1. **`packages/delivery/src/delivery.ts:96-99` and `:173-189`: the coordinator's wake for a dropped ticket's review still describes steps this round removed. So F1 is not fixed.**
   - **What changed this round:** a review of a dropped ticket that ends after the drop no longer moves the ticket (`delivery.ts:79`). It is not filed and not handed back (`hand-back.ts:103`). It is pruned at its end, together with the worker and the worker's branch (`delivery.ts:78`).
   - **What still happens:** delivery's `coordinator.wake` answer still runs `wake(recorded(...))` without checking the ticket's status.
   - **How I checked:** I added one throwaway line after `await ended(id);` in the new test "a review in its run when its ticket is dropped …" (`review.test.ts:449`) and ran that test. The wake was:
     `Review verdict: FAIL on arthur/2026-01-01-worker-4ea4e46e at f78f52d, 1 since its last PASS; AC0002 moves back to in-progress. Delivery files it as the next review-N.md in AC0002's folder; commit that, then arthur prune 2026-01-01-review-ecd0fcd9. It hands the branch back: 2026-01-01-worker-4ea4e46e continues with the findings and a new budget, and the next review starts when it ends; arthur stopall cancels it.`
   - **Every claim in that wake is false at that point:**
     - AC0002 stays `dropped`.
     - Nothing is filed.
     - The review is already pruned, so `arthur prune <id>` can only fail.
     - The worker and its branch are gone, so nothing is handed back and no next review comes.
   - **Why it fails the branch:**
     - This is F1's problem in a new form: the coordinator gets a command for a job that is already pruned. F1's own suggestion was to say `its ticket <id> is dropped; nothing to hand back`.
     - It contradicts the new text in `packages/delivery/docs/commands/review.md` ("neither filed nor handed back").
     - It contradicts the worker's claim of "no message". The new tests only look at `coordinator-message` events, never at the wake.
     - A PASS of a dropped ticket has the same problem: its wake says "moves to done. File it: arthur ticket file …" for a review that is already pruned.
   - **Fix:** the wake for a review whose ticket is `dropped` should say that it was neither filed nor handed back and that delivery pruned it. A test should check that wake.

2. **`packages/delivery/src/ticket-prune.ts:15`: the step beyond the finding (a merge ends the hand-backs of its ticket's jobs, including a worker still in a run) has no test.**
   - **Mutation:** `for (const id of all) endHandBack(host, id);` changed to `for (const id of all) if (drop) endHandBack(host, id);`.
   - **Result:** `merge.test.ts` and `review.test.ts` still pass, 46 of 46.
   - **Why it matters:** the worker's message gives the reason for this step (otherwise a merge would later have the hand-back review a merged ticket and send "Hand it back yourself"). But no test exercises it, and `merge.test.ts` never mentions a hand-back. Under the review criteria, a new behavior whose test still passes with the behavior removed is a FAIL.
   - The step itself is safe: `hand-back.ts` `step()` blocks a job it started if the job's record vanished meanwhile, so ending a hand-back cannot bring it back.

## Review 2's finding
Fixed. On a drop, a worker waiting in a hand-back now has its record ended and is pruned with `git branch -D`. The new test checks that the record, the job and the branch are all gone, and that the coordinator gets no "Hand it back yourself" message.

## Notes (not blocking)
- The prune at a job's end (`delivery.ts:78`) runs inside delivery's `job-ended` handler. Orchestration's wake reads `host.jobs.result(id)` in its own handler for the same event. With orchestration loaded first, as in `arthur.config.example.ts`, the wake reads the result before the prune. With delivery first, the wake would read an empty final message.
- The delivery line budget of 1728 matches AR-D338, and the github budget of 951 matches AR-D335. `delivery/src` totals exactly 1728 lines; `merge-command.ts` has 200.
- The `review-pass` stub no longer prunes the review twice. Putting the round-2 `scenario.json` back makes `scenarios.test.ts` fail (1 test).

## Checks run
- **`npm ci` and `npm run check`:** both pass. `npm ci`'s output was discarded; `npm run check` (tsc) printed no error.
- **`npm test`:** 1308 tests, 1246 pass, 0 fail, 62 skipped, as the worker claims. No `limits.test.ts` failure, so I did not run that file alone.
- **Throwaway wake probe:** the line added to `review.test.ts` produced the wake quoted in finding 1. Restored.
- **Mutations**, each restored with `git checkout --`; `git status --porcelain` was empty afterwards:

| Mutation | Tests run | Result |
|---|---|---|
| Hand-backs ended only on a drop (`if (drop)`) | merge + review | not caught (46 pass) |
| Hand-back ending removed entirely | review | caught (1 fail) |
| Prune at a dropped ticket's job end removed (`delivery.ts:78`) | merge + review | caught (2 fail) |
| Dropped-ticket check removed from the verdict move (`delivery.ts:79`) | review | caught (1 fail) |
| Dropped-ticket skip removed from the hand-back (`hand-back.ts:103`) | review | caught (1 fail) |
| Stub's double prune put back (`review-pass/scenario.json`) | develop `scenarios.test.ts` | caught (1 fail) |

FAIL
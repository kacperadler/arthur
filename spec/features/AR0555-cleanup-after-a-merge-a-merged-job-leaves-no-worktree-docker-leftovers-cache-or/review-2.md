# AR0555 - Review 2

- Job: 2026-10-29-review-018ff36b
- Branch: arthur/2026-10-29-worker-b17e611d
- Commit reviewed: 80e4fa1165b232b0c850d62bc2685106e8497893
- Verdict: FAIL

## Final message

**Review 2 of AR0555, branch `arthur/2026-10-29-worker-b17e611d` at `80e4fa11`**

The blocking finding from review 1 is fixed: both ticket-match mutations now fail the tests. One finding still blocks the merge. The new hand-back keep leaves a dropped ticket's worker behind for good, and the command it tells the user to run does not remove it.

## Findings

1. **`packages/delivery/src/ticket-prune.ts:15-16`: a worker kept on a drop is never freed, and `arthur prune <id>` does not free it.**
   - **What happens:** a worker waiting in a hand-back is skipped by the drop and gets the line `<id>: kept: … arthur prune <id> once that ends`. The drop handler (`delivery.ts`, `ticket-moved` to `dropped`) never runs again for that ticket. The core's `arthur prune` uses `git branch -d`, so on that worker's unmerged branch it keeps the branch and the record.
   - **How I checked:** I added `fake.host.jobs.prune([one.id])` to the hand-back test in `review.test.ts`, after "the hand-back ended", and ran it. The output was `…: worktree … removed; kept branch arthur/2026-01-01-worker-12083e22 and the record: git branch: error: the branch '…' is not fully merged.` I restored the file afterwards.
   - **Why it fails the branch:**
     - The Done means point "A dropped ticket's jobs are cleaned the same way" is not met for this case. The record and the unmerged branch stay forever, unless someone runs `git branch -D` by hand.
     - The kept line names a next command that does not do what it says. The same text is in `packages/delivery/docs/commands/merge.md:55` and `packages/delivery/docs/delivery.md:20`.
     - The worker's final message says "The worker then stays until someone runs `arthur prune <id>`". That does not match what I saw.
   - **F1 is not really fixed:** the coordinator still gets "Hand it back yourself: arthur continue <id> …" for a dropped ticket. The test asserts that message, and `continue` can only be refused for a dropped ticket. Yet `findings.md` marks F1 `fixed in 18081b3d`.
   - **Smaller fix:** on a drop, delivery removes its own `hand-backs/<worker>.json` for the ticket's workers that are not in a run. The prune and `-D` then go ahead as for any other ended job. This is close to what F1 itself suggests: "the hand-back drops a pending entry whose ticket is dropped".

## Notes (not blocking)

- **Double prune in `packages/delivery/evals/review-pass/scenario.json:29`:** the stubbed merge output now prunes `2026-10-22-review-1f2e3d4c`.
  - **Why it is wrong:** the scripted correct turn (`packages/develop/test/scenarios.test.ts:137`) runs `arthur prune 1f2e3d4c` before the merge, as the PASS wake says ("File it … commit it, then arthur prune <review>", `delivery.ts:172`). A real merge lists jobs through `host.jobs.list()`, so after that prune it could not list the review again. The stub's line can't happen on the correct path. The stub before this round, which pruned only the worker, matched that path.
  - **Fix:** take that line back out of the stub, or drop the pre-merge prune from the wake and the scripted turn.
- **Line budgets:** github 951 and delivery 1723 in `test/structure.test.ts` match AR-D335. All files are under 200 lines, and `npm test` includes the structure test.
- **Departure from the plan, with a reason given:** the sweep is `arthur github branch sweep`, in `github-branch.ts`, not `sweep-branches`. The ticket's "or" wording allows it, and the worker's message gives the reason.

## Checks I ran

- `npm ci`: passes (24 packages).
- `npm run check` (tsc): passes.
- `npm test`: 1307 tests, 1245 pass, 0 fail, 62 skipped, as the worker claims. No `limits.test.ts` failure, so I did not need to run it alone.
- Throwaway probe in `review.test.ts` (finding 1): the kept worker's `arthur prune` keeps its branch and record. Restored with `git checkout --`.
- Mutations, each restored with `git checkout --`; `git status --porcelain` is empty at the end:

| Mutation | Tests | Result |
|---|---|---|
| Ticket match replaced with `FEATURE.test(path)` | merge + review | caught (2 fail) |
| `${ticket}-` changed to `${ticket}` | merge + review | caught (2 fail) |
| Hand-back keep removed (`ids = all`) | merge + review | caught (1 fail) |
| `job.project === project &&` removed | merge + review | caught (1 fail) |
| `to === "dropped" &&` removed in `delivery.ts` | merge | caught (28 fail) |
| `JOB.test(id) &&` removed in delivery's `jobs.keep` | merge | caught (1 fail) |
| Push recorded on a failed push (`github.ts`) | `github-branch.test.ts` | caught (1 fail) |

FAIL
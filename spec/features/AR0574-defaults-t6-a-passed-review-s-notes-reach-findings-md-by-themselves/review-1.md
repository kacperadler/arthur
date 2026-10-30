# AR0574 - Review 1

- Job: 2026-10-30-review-cc3e32bd
- Branch: arthur/2026-10-30-worker-44de7e7b
- Commit reviewed: 77614c9c9368369e79822158ff02f5608afd8cf9
- Verdict: PASS

## Final message

The branch does what AR0574 asks. Every Done means point holds, `npm run check` and `npm test` pass in my checkout, and the worker's claims reproduce. I found nothing that blocks the merge.

## Findings

None.

### What you asked me to judge

- **Eval change outside Scope:** it was needed. `packages/develop/test/scenarios.test.ts:321-322` requires every eval's merge output to end with the current `after-merge.md`. Deleting the notes step (which the ticket asks for) therefore forces changes to the merge outputs in `delivery/merge`, `review-pass` and both session evals. The old `delivery/merge` scenario also checked the deleted behaviour: a findings.md the coordinator wrote, `arthur ticket new` calls, and main moving.
- **The new eval still checks something real:**
  - The coordinator must run `arthur merge`.
  - It must never run `arthur ticket new` by hand, so the old copying behaviour now scores as wrong.
  - Its reply must name SH0016, the ticket the merge made, which is the new step 1 (tell the owner the tickets made from findings).
  - The acted test's wrong run fails on both of those checks.
  - The old 3/3 baseline no longer fits, and F1 records that. I did not run the paid eval.
- **F2:** it is a correct consequence of the binding plan, which says to delete the step. It is properly recorded as open and named in the final message. It is narrower than the actual loss, though (see the first note).
- **No duplicates on a repeated merge:** `withNotes` (`on-merge.ts:67`) returns the text unchanged once the file holds `- Found by: <review> (review), `. The test asks twice with the same review and checks that findings.md is identical and no ticket is added. Removing the guard fails that test.
- **A `minor` note never reaches findings.md:** the pattern `NOTE` (`on-merge.ts:17`) only accepts `security|bug|risk`. The tests cover it at the plugin level (a minor-only call makes no file) and end to end in `test/findings-merge.test.ts`, where the minor README note is absent from findings.md. Adding `minor` to the pattern fails both tests.

## Notes

- `packages/delivery/roles/coordinator/after-merge.md:1`: the deleted step also held the fallback "when the merge said `no plugin provides findings.onMerge`, settle its open entries the same way". So without the findings plugin, a worker's own open entries are no longer settled by anyone either, not only the review notes. F2 names only the notes and should be widened to cover this.
- `test/structure.test.ts:15`: the delivery budget went up by 9 against the plan's estimate of 8. Findings went up by 22 against 25. Both are measured and named in the final message, so I'm not counting the one extra line against the branch.
- `packages/findings/src/on-merge.ts:17`: the title ends at the first `. `, so a note like `- (bug) a.ts:1: Use e.g. X. why` gets the title "Use e.g". That is a cosmetic problem with free text.
- `packages/delivery/evals/merge/scenario.json`: the stubbed findings.md starts with a one-line head, but the plugin would write the template's two-paragraph head. This only affects a stub output and does not change the scoring.

## Checks

- `npm ci`: 24 packages added.
- `npm run check && npm test`, in one call with a 1800 s timeout: tsc reported no errors; 1369 tests, 1307 pass, 0 fail, 0 cancelled, 62 skipped. No failure in `limits.test.ts`.
- **Fails on the base, passes on the tip:** with `on-merge.ts` and `merge-outcome.ts` put back to the base, the three named test files had 5 failures and 39 passes. Those are the 5 tests the worker named. Both files were restored after.
- **Mutations:** every one below failed at least one test. Each was run on its own and restored with `git checkout`; the tree is clean.
  - Dedup guard removed: 1 failure.
  - `minor` admitted to the kind pattern: 2 failures (plugin test and end-to-end test).
  - `|| text !== had` dropped: 1 failure.
  - Numbering starts at 0: 1 failure.
  - Risk mapped to kind `risk`: 2 failures.
  - `findLast` changed to `find`: `merge.test.ts` notes test fails.
  - PASS filter removed: `merge.test.ts` notes test fails.
  - Branch filter removed: `merge.test.ts` notes test fails.
  - Two of my early runs mutated the same file at the same time, so I threw those results away and reran each mutation alone.

PASS
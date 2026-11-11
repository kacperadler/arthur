# AR0679 - Review 1

- Job: 2026-11-11-review-b084ad06
- Branch: arthur/2026-11-11-worker-72edd925
- Commit reviewed: af42a6a2bd995636b6a073e149bbc76a5a36d425
- Verdict: PASS

## Final message

**AR0679 review: PASS.** I found nothing that blocks the merge. The diff meets every point of the ticket's "Done means", and stays within the files its Scope allows.

- **Grant:** `packages/orchestration/src/silent.ts:47` adds `"plan"` to the kinds `byRecommendation` never answers. The grant's wording at `silent.ts:89` now starts "never a plan question". With the grant in force, a `--kind plan --recommend 1` ask prints only `AC-D11` (`silent.test.ts:347`). The log's only answer by recommendation stays `AC-D10`.
- **Classes:** `packages/orchestration/src/decision-classes.ts:47` gives no match for a `plan` question. So `ask` in `decision-writes.ts:29-31` gets no policy answer and names no class. The grant is still tried, and skips the question. The new test at `decisions.test.ts:985` shows an approved plan class whose words match leaves `AC-D3` open, with its last record an `ask`.
- **Bypasses checked:**
  - `--kind` is checked exactly against `KINDS` (`decision-writes.ts:16`), so a `Plan` or `plan ` variant is refused.
  - Asking a plan approval as `--kind question` would let the grant answer it, but `ticket status ... planned --decision` refuses an answer of another kind (`decision.md:87`, `decision-use.ts`).
  - `byPolicy` is only called from `ask`, so no other path lets a class answer a plan question.
- **Docs:** `decision.md:32`, its grant sentence at `decision.md:37` and its "Classes" section at `decision.md:75` now say a plan question always goes to the owner, and `silent.md:22` does too. Searching `packages/`, `spec/`, `.agents/` and the README found no line that still says the grant or a class answers plan questions, and no leftover of the old "never a merge question, ..." wording.
- **Other kinds:** they are still answered as before; the existing tests pass.
- **Structure:** no source file moved into yellow. The `structure.test.ts` checks pass, so the orchestration line budget holds without a raise.
- **Commit:** one commit, `fix(AR0679): ...`. The worker's final message matches the diff and the results below.

## Notes
- (minor) `packages/orchestration/test/decision-use.test.ts:107`: the comment "The grant never answers a merge or a budget question" is still true but does not mention plan. It is outside the range, so not a finding.

## Checks run (on `af42a6a2`)
- `npm run check`: tsc passes. Run in the same call as `npm test`, whose exit code that pipeline hid, so I ran `npm test` again on its own.
- `npm test`: 1697 tests, 1633 pass, 0 fail, 0 cancelled, 64 skipped; exit 0.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived; 5 not run (`--max 25`).
- Hand mutation: I removed `"plan"` from the list in `silent.ts` and the `ask.kind === "plan" ? [] :` guard in `decision-classes.ts`. Then I ran `node --import @arthur/core/testing --test --test-name-pattern="plan question"` on `silent.test.ts` and `decisions.test.ts`: 2 tests, 0 pass, 2 fail. They printed `AC-D3 answered by policy (AC-D2): Approve` and `AC-D11 answered by recommendation (G2): Approve`. I restored both files with `git checkout --`, and the tree is clean.

PASS
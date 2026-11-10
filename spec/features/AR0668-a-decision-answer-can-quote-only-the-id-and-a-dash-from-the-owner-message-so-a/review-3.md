# AR0668 - Review 3

- Job: 2026-11-10-review-e17f88a4
- Branch: arthur/2026-11-09-worker-bb08f8e6
- Commit reviewed: e05ea0860f5f86d306e0a096f82292da784fd309
- Verdict: FAIL

## Final message

## Findings

1. **`packages/orchestration/src/decision-proof.ts:25-26`: you can still pass the fragment rule by adding spaces.** The rule counts words split on whitespace. The matcher (`pattern`) ignores whitespace when it looks for the words in his message. So inserting a space changes the word count but not the match. I called `proof()` directly with his message `AR-D12 no, do not merge — what is this?` and `id = "AR-D12"`:
   - `"AR-D1 2"` passed (seq 1). The strip regex removes `AR-D1`, which leaves the one word `2`, and `pattern("AR-D12")` matches the words. So this quote is nothing but the id, and it proves the answer.
   - `"A R-D12"` passed (seq 1). Same cause: `R-D12` is stripped, which leaves `A`.
   - `"n o"` passed (seq 1). That is two words to the rule, while `pattern("no")` matches his `no`. The ticket's test row says `no` must be refused, and this is `no` with a space.
   - Correctly refused in the same run: `AR-D12`, `—`, `no`, `n`, `AR-D12 —`, `AR -D12`.
   
   This breaks the Done-means rule that words which are "only the id, punctuation or a single character are refused". A steered coordinator can still record a high-impact answer from a fragment. The notice is then the only defence. None of the tests try an id split by whitespace or a word split into letters.
   
   A fix: apply the word rule to the part of `said(text)` that the pattern matched, not to the raw `--words`. Or strip whitespace the same way in both places.

## Notes
- (minor) `test/structure.test.ts:42`: the orchestration budget goes from 2829 to 2846. Review 2 already covered this. The coordinator decides whether the owner's OK is needed, and the raise must appear in the merge's outcome.md.
- (minor) `packages/orchestration/src/decision-proof.ts:25`: the id strip `[a-z]+\s*-\s*d\s*\d+` depends on project prefixes being only letters. `board.ts:193` guarantees that today (capital A–Z), so there is no bypass through a prefix with digits.

## Checks (on e05ea086)
- `npm run check`: tsc passed.
- `npm test`: tests 1678, pass 1614, fail 0, cancelled 0, skipped 64. The seven yellow files are all in core, delivery and session; none are in orchestration.
- `npm run mutate` (default max): 25 mutants, 25 caught, 0 survived; 69 not run (--max 25).
- Throwaway probe in a temporary folder `/tmp/rv-e17f88a4`, removed afterwards: called `proof()` from `decision-proof.ts` with the review-1 message and the 12 quotes listed in finding 1. `AR-D1 2`, `A R-D12`, `n o`, `AR-D12 n o`, `do not` and `AR-D12 no` passed; `AR-D12`, `—`, `no`, `n`, `AR-D12 —` and `AR -D12` were refused.
- Review 2's finding is fixed. `decisions.test.ts:301-306` now checks that the notice redacts the env value and the `sk-live-…` key, and that no emitted event holds either.
- After the runs, `git status --short` was empty and no fake agent of this checkout was still running.

FAIL
# AR0658 - Review 3

- Job: 2026-11-09-review-2bf8f8c5
- Branch: arthur/2026-11-08-worker-54bdf673
- Commit reviewed: ee5ccf6730f207d6e47dbb81b5622f407175225d
- Verdict: PASS

## Final message

No finding blocks the merge. Review-2's finding is fixed: removing `&& left < RUN_MS` from `test/mutate.ts:217` now makes 1 of 9 tests in `test/mutate.test.ts` fail.

The diff is the ticket's After code, plus a change to `killed`/`passes` that Done means point 2 needs: `passes` gets `end`, sets the spawn timeout to `Math.min(RUN_MS, left)`, returns `undefined` when `left <= 0`, and counts a SIGKILL with less than `RUN_MS` left as cut by the deadline. All three Done means points are met:
- **Point 1:** with the deadline passed, no mutant starts and the summary counts the rest as `not run (time)`. The tests fail when the deadline check is removed.
- **Point 2:** a mutant whose tests the deadline cuts counts as not run. The test checks that its file is restored and its process is gone, and is bounded to 60 s.
- **Point 3:** check and test pass.

The worker's claimed checks match my results on ee5ccf67. Its final message explains the growth of `test/mutate.ts` (211 → 226 lines). `test/structure.ts` does not size root `test/` files, so no zone applies. The only other changed file is the ticket's `findings.md`.

## Notes
- (minor) packages/delivery/src/checks-extension.ts:77: the regex reads only the first `not run` part of the summary, so a run the deadline cut looks to the review gate like one capped by `--max`. `review-needed.md:33` describes that parsing. Both files are outside the ticket's Scope; this is already filed as F1, so the merge should not file it twice.
- (minor) test/mutate.ts:217: any SIGKILL in the deadline's last 600 s counts as the deadline's cut. Already filed as F3.
- (minor) test/mutate.test.ts:107: a blocking fixture test can outlive a mutate run (F2). My mutate run and hand mutations left none (`pgrep` printed nothing).
- (minor) test/mutate.ts:72: changing `break` to `continue` would survive. It behaves the same under a real clock, as reviews 1 and 2 noted.
- (minor) The branch has 5 commits, against the 1 to 3 the review criteria call usual.

## Checks (on ee5ccf67, clean tree)
- `npm run check`: tsc clean.
- `npm test`: tests 1651, pass 1587, fail 0, cancelled 0, skipped 64.
- `npm run mutate`, in a call of its own: `mutate: 25 mutants, 25 caught, 0 survived; 31 not run (--max 25)`, exit 0, 520 s. Afterwards `pgrep -af limit.test.ts` printed nothing.
- Hand mutations of `test/mutate.ts`, each run with `node --import @arthur/core/testing --test test/mutate.test.ts` and restored with `git checkout -- test/mutate.ts`. All were caught:

| Mutation | Pass | Fail |
|---|---|---|
| `&& left < RUN_MS` removed | 8 | 1 |
| `left < RUN_MS` → `left <= RUN_MS` | 8 | 1 |
| Loop deadline check `Date.now() < deadline` → `true` | 7 | 2 |
| `timeout: Math.min(RUN_MS, left)` → `RUN_MS` (fails at about 68 s) | 8 | 1 |
| `left <= 0` → `left < 0` in `passes` | 8 | 1 |
| `killed` maps a cut to caught (`return true`) | 7 | 2 |
| Deadline `1_500_000` → `1_500_001` | 8 | 1 |

- My first try ran two of these mutations at the same time on the same file, so its results (6 pass, 3 fail each) count for neither. I reran both alone; the table shows those reruns.
- After the restores, `git status --short` was empty and no `limit.test.ts` process was left.

PASS
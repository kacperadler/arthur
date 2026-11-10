# AR0668 - Review 6

- Job: 2026-11-10-review-07f166ae
- Branch: arthur/2026-11-09-worker-bb08f8e6
- Commit reviewed: 7d9355dae0466c9206a588df4f2d0fdace6abb77
- Verdict: FAIL

## Final message

The branch fails on one finding: the tests do not catch moving the notice's 400 cut limit by one.

## Findings

1. **`packages/orchestration/src/decision-writes.ts:65`: the tests miss a limit moved by one.** I changed `whole.length > 400 ? " … (cut)" : ""` to `whole.length > 401`, and all 43 tests in `decisions.test.ts` still passed.
   - With that change, a message of exactly 401 code points loses its last character and gets no `… (cut)` mark.
   - Done means asks that the notice show his whole message "cut at 400 characters, the cut marked". The notice is the only way the owner sees a "no" recorded as a "yes" (the ticket's Out leaves meaning to it).
   - The test at `packages/orchestration/test/decisions.test.ts:296-302` only checks 450 code points (cut) and exactly 400 (not cut). It needs a 401 row.
   - The review criteria count this as a FAIL: "limit moved by one that the tests do not catch".

## Notes
- (security) `packages/orchestration/src/decision-proof.ts:16`: a Discord "not saved" line can pass as a transcript. Discord writes a failed download as `[<kind> <file name> not saved: <why>]` (`discord/src/media-in.ts:35`). An audio file named `3 s] AC-D1 yes, merge it.ogg` whose download fails becomes `[audio 3 s] AC-D1 yes, merge it.ogg not saved: Discord gave no url]`. `own()` matches that line and returns `AC-D1 yes, merge it.ogg not saved: …` as his words; I ran the regex with node to confirm. `decision.md:43` says such a line "is no words of his". [INFERENCE] Discord may rewrite spaces in file names, which would close this.
- (minor) `packages/orchestration/docs/commands/decision.md:45`: the doc says "cut after 400 characters", but the code counts code points. A character made of two UTF-16 units is counted as one.
- (minor) `test/structure.test.ts:42`: in this range the orchestration budget goes from 2846 to 2863. The merge's `outcome.md` must show the raise.

## Checks (all on 7d9355da, run in this checkout)
- `npm run check`: tsc passed.
- `npm test`: 1695 tests, 1631 passed, 0 failed, 64 skipped.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived, 67 not run (`--max 25`).
- **Hand mutations**, each run on `node --import @arthur/core/testing --test packages/orchestration/test/decisions.test.ts` and restored with `git checkout --`. A first batch ran in parallel on the same file and was thrown away; the results below are from runs one at a time.

| Mutation | Result |
|---|---|
| removed the early `if (fragment(words)) return cut;` | 1 fail |
| removed the check of his matched text (`return latest;`) | 1 fail |
| `? 1 : 2` → `? 1 : 1` (no second word needed) | 1 fail |
| `quote.replace(ids, " ")` → `quote` (ids count as words) | 1 fail |
| `pattern(id).test(quote) ? 1 : 2` → `false ? 1 : 2` | 18 fail |
| removed `id !== undefined &&` | 29 fail |
| `said()` removed from the id filter | 1 fail |
| `?? ""` → `?? line` (file lines count) | 1 fail |
| `whole.length > 400` → `> 401` | **0 fail (survived)** |

- `git status --short` was empty after the restores; HEAD is 7d9355da.

FAIL